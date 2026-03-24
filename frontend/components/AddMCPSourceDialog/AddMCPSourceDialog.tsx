"use client";

import { useCallback, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Loader2,
  Lock,
  Search,
  ShieldCheck,
} from "lucide-react";
import { mcpSourcesAPI } from "@/lib/admin/mcp-sources-api";
import { createMcpSourceMutation } from "@/queries/mcpSource.queries";

import type { MCPProbeResult, MCPToolSource } from "@/types/mcpSource";

interface AddMCPSourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  onSourceAdded: (source: MCPToolSource) => void;
}

type Step = "form" | "result";
type ProbeStatus = "idle" | "probing" | "done" | "error";

export function AddMCPSourceDialog({
  open,
  onOpenChange,
  productId,
  onSourceAdded,
}: AddMCPSourceDialogProps) {
  const [step, setStep] = useState<Step>("form");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [createdSource, setCreatedSource] = useState<MCPToolSource | null>(null);

  // Probe state
  const [probeStatus, setProbeStatus] = useState<ProbeStatus>("idle");
  const [probeResult, setProbeResult] = useState<MCPProbeResult | null>(null);

  // Auth fields
  const [bearerToken, setBearerToken] = useState("");
  const [showManualAuth, setShowManualAuth] = useState(false);
  const [manualHeaderName, setManualHeaderName] = useState("");
  const [manualHeaderValue, setManualHeaderValue] = useState("");

  const createMutation = useMutation({
    ...createMcpSourceMutation(),
    onSuccess: (source) => {
      setCreatedSource(source);
      setStep("result");
    },
  });

  const resetForm = () => {
    setStep("form");
    setName("");
    setUrl("");
    setCreatedSource(null);
    setProbeStatus("idle");
    setProbeResult(null);
    setBearerToken("");
    setShowManualAuth(false);
    setManualHeaderName("");
    setManualHeaderValue("");
    createMutation.reset();
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) resetForm();
    onOpenChange(nextOpen);
  };

  const handleProbe = useCallback(async () => {
    if (!url.trim()) return;
    setProbeStatus("probing");
    setProbeResult(null);
    setShowManualAuth(false);
    setBearerToken("");
    try {
      const result = await mcpSourcesAPI.probe(url.trim());
      setProbeResult(result);
      setProbeStatus(result.reachable ? "done" : "error");
      if (!result.reachable) {
        setShowManualAuth(true);
      }
    } catch {
      setProbeStatus("error");
      setShowManualAuth(true);
    }
  }, [url]);

  const handleSubmit = () => {
    const detectedType = probeResult?.detected_type;
    let authType: "none" | "bearer" | "header" | "oauth" = "none";
    let authCredentials: Record<string, string> = {};

    if (detectedType === "oauth") {
      authType = "oauth";
    } else if (detectedType === "bearer" || (showManualAuth && bearerToken)) {
      authType = "bearer";
      if (bearerToken) {
        authCredentials = { token: bearerToken };
      }
    } else if (showManualAuth && manualHeaderName && manualHeaderValue) {
      authType = "header";
      authCredentials = {
        header_name: manualHeaderName,
        header_value: manualHeaderValue,
      };
    }

    createMutation.mutate({
      name,
      url: url.trim(),
      auth_type: authType,
      ...(Object.keys(authCredentials).length > 0 && {
        auth_credentials: authCredentials,
      }),
      product_id: productId,
    });
  };

  const handleDone = () => {
    if (createdSource) {
      onSourceAdded(createdSource);
    }
    handleOpenChange(false);
  };

  const isFormValid = name.trim() && url.trim() && probeStatus !== "idle";
  const needsToken =
    probeResult?.detected_type === "bearer" ||
    (showManualAuth && !probeResult?.reachable);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        {step === "form" && (
          <>
            <DialogHeader>
              <DialogTitle>Add MCP Source</DialogTitle>
              <DialogDescription>
                Enter a server URL and we&apos;ll detect its authentication
                requirements.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="dialog-mcp-name">Name</Label>
                <Input
                  id="dialog-mcp-name"
                  placeholder="e.g. Datadog"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dialog-mcp-url">Server URL</Label>
                <div className="flex gap-2">
                  <Input
                    id="dialog-mcp-url"
                    type="url"
                    placeholder="https://mcp.example.com/mcp"
                    value={url}
                    onChange={(e) => {
                      setUrl(e.target.value);
                      if (probeStatus !== "idle") {
                        setProbeStatus("idle");
                        setProbeResult(null);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && url.trim()) {
                        e.preventDefault();
                        handleProbe();
                      }
                    }}
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleProbe}
                    disabled={!url.trim() || probeStatus === "probing"}
                    className="shrink-0 h-9 w-9"
                    title="Check connection"
                  >
                    {probeStatus === "probing" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Search className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Probe result */}
              <ProbeIndicator status={probeStatus} result={probeResult} />

              {/* Bearer token (probe detected) */}
              {probeStatus === "done" &&
                probeResult?.detected_type === "bearer" && (
                  <div className="space-y-2">
                    <Label htmlFor="dialog-mcp-token">
                      API Key / Bearer Token
                    </Label>
                    <Input
                      id="dialog-mcp-token"
                      type="password"
                      placeholder="Token"
                      value={bearerToken}
                      onChange={(e) => setBearerToken(e.target.value)}
                    />
                  </div>
                )}

              {/* Manual fallback */}
              {(probeStatus === "error" ||
                (probeStatus === "done" && !probeResult?.reachable)) && (
                <Collapsible
                  open={showManualAuth}
                  onOpenChange={setShowManualAuth}
                >
                  <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform ${showManualAuth ? "rotate-0" : "-rotate-90"}`}
                    />
                    Configure authentication manually
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-3 space-y-3 rounded-md border p-3">
                      <div className="space-y-2">
                        <Label htmlFor="dialog-manual-token">
                          Bearer Token
                        </Label>
                        <Input
                          id="dialog-manual-token"
                          type="password"
                          placeholder="Token (optional)"
                          value={bearerToken}
                          onChange={(e) => setBearerToken(e.target.value)}
                        />
                      </div>
                      <div className="text-xs text-muted-foreground">
                        — or use a custom header —
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor="dialog-manual-header-name">
                            Header Name
                          </Label>
                          <Input
                            id="dialog-manual-header-name"
                            placeholder="X-Api-Key"
                            value={manualHeaderName}
                            onChange={(e) => setManualHeaderName(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="dialog-manual-header-value">
                            Header Value
                          </Label>
                          <Input
                            id="dialog-manual-header-value"
                            type="password"
                            placeholder="Value"
                            value={manualHeaderValue}
                            onChange={(e) =>
                              setManualHeaderValue(e.target.value)
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {createMutation.isError && (
                <div className="flex items-start gap-2 text-sm text-red-500">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    {createMutation.error instanceof Error
                      ? createMutation.error.message
                      : "Failed to create MCP source"}
                  </span>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={
                  !isFormValid ||
                  createMutation.isPending ||
                  probeStatus === "probing" ||
                  (needsToken && !bearerToken && !manualHeaderName)
                }
              >
                {createMutation.isPending && (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                )}
                Connect
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "result" && createdSource && (
          <>
            <DialogHeader>
              <DialogTitle>
                {createdSource.oauth_status === "authorization_required"
                  ? "Authorization Required"
                  : "Source Connected"}
              </DialogTitle>
              <DialogDescription>
                {createdSource.oauth_status === "authorization_required"
                  ? `${createdSource.name} requires OAuth authorization. Click "Authorize" to connect.`
                  : createdSource.discovery_status === "success"
                    ? `Discovered ${createdSource.tool_count} tool${createdSource.tool_count !== 1 ? "s" : ""} from ${createdSource.name}.`
                    : `${createdSource.name} was added but tool discovery ${createdSource.discovery_status === "pending" ? "is still running" : "failed"}.`}
              </DialogDescription>
            </DialogHeader>

            <div className="py-2">
              {createdSource.oauth_status === "authorization_required" && (
                <div className="rounded-md border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-3">
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    This MCP server requires OAuth authentication. A new window
                    will open for you to authorize Pillar&apos;s access.
                  </p>
                </div>
              )}

              {createdSource.discovery_status === "success" &&
                createdSource.discovered_tools.length > 0 && (
                  <div className="rounded-md border divide-y max-h-48 overflow-y-auto">
                    {createdSource.discovered_tools.map((tool) => (
                      <div key={tool.name} className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                          <span className="text-sm font-medium">
                            {tool.name}
                          </span>
                        </div>
                        {tool.description && (
                          <p className="text-xs text-muted-foreground ml-5.5 mt-0.5 truncate">
                            {tool.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

              {createdSource.discovery_status === "error" &&
                createdSource.discovery_error && (
                  <div className="flex items-start gap-2 text-sm text-red-500 rounded-md border border-red-200 dark:border-red-900 p-3">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{createdSource.discovery_error}</span>
                  </div>
                )}
            </div>

            <DialogFooter>
              {createdSource.oauth_status === "authorization_required" ? (
                <>
                  <Button variant="outline" onClick={handleDone}>
                    Later
                  </Button>
                  <Button
                    onClick={async () => {
                      try {
                        const url = await mcpSourcesAPI.getOAuthAuthorizeUrl(createdSource.id);
                        window.open(url, "_blank");
                      } catch {
                        // handled by error boundary
                      }
                    }}
                  >
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                    Authorize
                  </Button>
                </>
              ) : (
                <Button onClick={handleDone}>Done</Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ProbeIndicator({
  status,
  result,
}: {
  status: ProbeStatus;
  result: MCPProbeResult | null;
}) {
  if (status === "idle" || status === "probing") return null;

  if (!result?.reachable) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-2.5">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
        <div className="text-xs text-amber-700 dark:text-amber-300">
          <p className="font-medium">Could not reach server</p>
          {result?.error && <p className="mt-0.5 opacity-80">{result.error}</p>}
        </div>
      </div>
    );
  }

  if (!result.auth_required) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/30 p-2.5">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-green-600 dark:text-green-400" />
        <span className="text-xs text-green-700 dark:text-green-300">
          No authentication required
        </span>
      </div>
    );
  }

  if (result.detected_type === "oauth") {
    return (
      <div className="flex items-start gap-2 rounded-md border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30 p-2.5">
        <Lock className="h-3.5 w-3.5 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
        <div className="text-xs text-blue-700 dark:text-blue-300">
          <p className="font-medium">OAuth 2.1 detected</p>
          <p className="mt-0.5 opacity-80">
            You&apos;ll authorize access after connecting.
          </p>
        </div>
      </div>
    );
  }

  if (result.detected_type === "bearer") {
    return (
      <div className="flex items-center gap-2 rounded-md border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-2.5">
        <Lock className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
        <span className="text-xs text-amber-700 dark:text-amber-300">
          Authentication required — enter a token below
        </span>
      </div>
    );
  }

  return null;
}
