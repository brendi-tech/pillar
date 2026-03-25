"use client";

import { SDKSetupStep } from "@/components/Onboarding/SDKSetupStep";
import { ToolsSyncModal } from "@/components/ToolsSyncModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { mcpSourcesAPI } from "@/lib/admin/mcp-sources-api";
import { openAPISourcesAPI } from "@/lib/admin/openapi-sources-api";
import { useProduct } from "@/providers";
import {
  createMcpSourceMutation,
  mcpSourceKeys,
} from "@/queries/mcpSource.queries";
import {
  createOpenAPISourceMutation,
  openAPISourceKeys,
} from "@/queries/openAPISource.queries";
import type { MCPProbeResult, MCPToolSource, MCPToolConfigItem } from "@/types/mcpSource";
import type {
  OpenAPIProbeResult,
  OpenAPIToolSource,
  OpenAPIOperationConfigItem,
} from "@/types/openAPISource";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ClipboardCopy,
  ExternalLink,
  Globe,
  HelpCircle,
  Loader2,
  Lock,
  Monitor,
  Plus,
  Search,
  Server,
  ShieldCheck,
  Unplug,
  Users,
  Zap,
  Upload,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";

type WizardStep = "select" | "client" | "server" | "mcp" | "openapi";

interface ToolTypeOption {
  id: WizardStep;
  name: string;
  description: string;
  icon: typeof Monitor;
}

const TOOL_TYPES: ToolTypeOption[] = [
  {
    id: "client",
    name: "Client Tools",
    description:
      "Define tools in your client-side code using the Pillar SDK. These run in the user's browser.",
    icon: Monitor,
  },
  {
    id: "server",
    name: "Server Tools",
    description:
      "Define tools in your server-side code and sync them via CI/CD or the CLI.",
    icon: Server,
  },
  {
    id: "mcp",
    name: "MCP Source",
    description:
      "Connect an external MCP server to discover and use its tools.",
    icon: Unplug,
  },
  {
    id: "openapi",
    name: "OpenAPI Spec",
    description:
      "Paste an OpenAPI spec URL and we'll create tools from every endpoint.",
    icon: Globe,
  },
];

export function AddToolsWizard() {
  const [step, setStep] = useState<WizardStep>("select");

  return (
    <Card>
      <CardContent className="pt-6">
        {step === "select" && <SelectTypeStep onSelect={setStep} />}
        {step === "client" && (
          <ClientToolsStep onBack={() => setStep("select")} />
        )}
        {step === "server" && (
          <ServerToolsStep onBack={() => setStep("select")} />
        )}
        {step === "mcp" && <MCPSourceStep onBack={() => setStep("select")} />}
        {step === "openapi" && (
          <OpenAPISourceStep onBack={() => setStep("select")} />
        )}
      </CardContent>
    </Card>
  );
}

function SelectTypeStep({
  onSelect,
}: {
  onSelect: (step: WizardStep) => void;
}) {
  return (
    <div className="space-y-3 sm:space-y-4">
      <div>
        <h2 className="text-base sm:text-lg font-semibold">Select Tool Type</h2>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Choose what type of tools you want to add.
        </p>
      </div>

      <div className="grid gap-2 sm:gap-3">
        {TOOL_TYPES.map((type) => {
          const Icon = type.icon;
          return (
            <button
              key={type.id}
              onClick={() => onSelect(type.id)}
              className="flex items-center sm:items-start gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg border text-left transition-colors hover:bg-muted/50 border-border"
            >
              <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm sm:text-base font-medium">
                  {type.name}
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
                  {type.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ClientToolsStep({ onBack }: { onBack: () => void }) {
  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2">
        <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
        Back
      </Button>
      <SDKSetupStep initialSubStep={1} />
    </div>
  );
}

function ServerToolsStep({ onBack }: { onBack: () => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2">
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
          Back
        </Button>
        <div className="ml-auto">
          <ToolsSyncModal
            trigger={
              <Button variant="outline" size="sm">
                Sync Now
              </Button>
            }
          />
        </div>
      </div>
      <SDKSetupStep initialSubStep={1} />
    </div>
  );
}

type ProbeStatus = "idle" | "probing" | "done" | "error";

function MCPSourceStep({ onBack }: { onBack: () => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { currentProduct } = useProduct();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [url, setUrl] = useState("");

  // Probe state
  const [probeStatus, setProbeStatus] = useState<ProbeStatus>("idle");
  const [probeResult, setProbeResult] = useState<MCPProbeResult | null>(null);

  // Auth fields (shown adaptively based on probe result)
  const [bearerToken, setBearerToken] = useState("");
  const [showManualAuth, setShowManualAuth] = useState(false);
  const [manualHeaderName, setManualHeaderName] = useState("");
  const [manualHeaderValue, setManualHeaderValue] = useState("");

  // OAuth mode (org vs per-user)
  const [oauthMode, setOauthMode] = useState<"org" | "client">("org");

  // Created source
  const [createdSource, setCreatedSource] = useState<MCPToolSource | null>(null);

  const createMutation = useMutation({
    ...createMcpSourceMutation(),
    onSuccess: (source) => {
      setCreatedSource(source);
      queryClient.invalidateQueries({ queryKey: mcpSourceKeys.all });
    },
  });

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
    if (!currentProduct?.id) return;

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
      slug: slug || undefined,
      url: url.trim(),
      auth_type: authType,
      ...(Object.keys(authCredentials).length > 0 && {
        auth_credentials: authCredentials,
      }),
      ...(authType === "oauth" && { oauth_mode: oauthMode }),
      product_id: currentProduct.id,
    });
  };

  const handleDone = () => {
    if (createdSource) {
      router.push(`/tools/mcp/${createdSource.id}`);
    } else {
      router.push("/tools");
    }
  };

  const isFormValid = name.trim() && url.trim() && probeStatus !== "idle";
  const needsToken =
    probeResult?.detected_type === "bearer" ||
    (showManualAuth && !probeResult?.reachable);

  // ── Success state ──
  if (createdSource) {
    const isOAuthRequired =
      createdSource.oauth_status === "authorization_required";
    const isClientAuth = createdSource.oauth_mode === "client";

    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2">
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
          Back
        </Button>

        <div>
          <h2 className="text-base sm:text-lg font-semibold">
            {isOAuthRequired ? "Authorization Required" : "Source Connected"}
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {isOAuthRequired
              ? `${createdSource.name} requires OAuth authorization to discover tools.`
              : createdSource.discovery_status === "success"
                ? `Discovered ${createdSource.tool_count} tool${createdSource.tool_count !== 1 ? "s" : ""} from ${createdSource.name}.`
                : `${createdSource.name} was added but tool discovery ${createdSource.discovery_status === "pending" ? "is still running" : "failed"}.`}
          </p>
        </div>

        {isOAuthRequired && (
          <div className="rounded-md border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-3">
            <p className="text-sm text-amber-700 dark:text-amber-300">
              A new window will open for you to authorize Pillar&apos;s access
              to this MCP server.
            </p>
          </div>
        )}

        {isClientAuth && !isOAuthRequired && (
          <div className="rounded-md border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30 p-3">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Per-user authentication is enabled. Each end-user will be
              prompted to connect their own account when they first use a
              tool from this source.
            </p>
          </div>
        )}

        {createdSource.discovery_status === "success" &&
          createdSource.discovered_tools.length > 0 && (
            <MCPReviewScreen source={createdSource} />
          )}

        {createdSource.discovery_status === "error" &&
          createdSource.discovery_error && (
            <div className="flex items-start gap-2 text-sm text-red-500 rounded-md border border-red-200 dark:border-red-900 p-3">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{createdSource.discovery_error}</span>
            </div>
          )}

        {isOAuthRequired ? (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleDone}>
              Later
            </Button>
            <Button
              onClick={() => {
                (async () => {
                  try {
                    const url = await mcpSourcesAPI.getOAuthAuthorizeUrl(createdSource.id);
                    window.open(url, "_blank");
                  } catch {
                    // handled by error boundary
                  }
                })();
              }}
            >
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
              Authorize
            </Button>
          </div>
        ) : (
          <Button onClick={handleDone} className="w-full sm:w-auto">
            View Source
          </Button>
        )}
      </div>
    );
  }

  // ── Form state ──
  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2">
        <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
        Back
      </Button>

      <div>
        <h2 className="text-base sm:text-lg font-semibold">
          Connect MCP Source
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Enter a server URL and we&apos;ll detect its authentication
          requirements.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="mcp-name">Name</Label>
          <Input
            id="mcp-name"
            placeholder="e.g. Datadog"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slugTouched) {
                setSlug(
                  e.target.value
                    .toLowerCase()
                    .trim()
                    .replace(/[^a-z0-9\s-]/g, "")
                    .replace(/[\s]+/g, "-")
                    .replace(/-+/g, "-")
                    .slice(0, 40)
                );
              }
            }}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="mcp-slug" className="text-xs">
            Slug
          </Label>
          <Input
            id="mcp-slug"
            placeholder="e.g. datadog"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(
                e.target.value
                  .toLowerCase()
                  .replace(/[^a-z0-9-]/g, "")
                  .slice(0, 40)
              );
            }}
            className="font-mono text-xs h-8"
          />
          <p className="text-[11px] text-muted-foreground">
            Tool names will be prefixed with this slug
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="mcp-url">Server URL</Label>
          <div className="flex gap-2">
            <Input
              id="mcp-url"
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
              onClick={handleProbe}
              disabled={!url.trim() || probeStatus === "probing"}
              className="shrink-0"
            >
              {probeStatus === "probing" ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Search className="mr-1.5 h-3.5 w-3.5" />
              )}
              Check
            </Button>
          </div>
        </div>

        {/* Probe result indicator */}
        <ProbeResultBanner
          status={probeStatus}
          result={probeResult}
        />

        {/* OAuth mode selection (shown when probe detects OAuth) */}
        {probeStatus === "done" && probeResult?.detected_type === "oauth" && (
          <div className="space-y-3">
            <Label>Authentication mode</Label>
            <RadioGroup
              value={oauthMode}
              onValueChange={(v) => setOauthMode(v as "org" | "client")}
              className="grid gap-3"
            >
              <label
                htmlFor="oauth-mode-org"
                className={`flex items-start gap-3 rounded-lg border p-3.5 cursor-pointer transition-colors ${
                  oauthMode === "org"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/30"
                }`}
              >
                <RadioGroupItem value="org" id="oauth-mode-org" className="mt-0.5" />
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Organization authenticates</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    You authenticate once and all your users share that connection.
                    Best for company-wide services like Intercom, Datadog, or Sentry.
                  </p>
                </div>
              </label>
              <label
                htmlFor="oauth-mode-client"
                className={`flex items-start gap-3 rounded-lg border p-3.5 cursor-pointer transition-colors ${
                  oauthMode === "client"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/30"
                }`}
              >
                <RadioGroupItem value="client" id="oauth-mode-client" className="mt-0.5" />
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Each end-user authenticates</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Each end-user connects their own account when they first use a tool.
                    Best for personal services like Stripe, GitHub, or Google Calendar.
                  </p>
                </div>
              </label>
            </RadioGroup>
          </div>
        )}

        {/* Bearer token field (shown when probe detects bearer auth) */}
        {probeStatus === "done" && probeResult?.detected_type === "bearer" && (
          <div className="space-y-2">
            <Label htmlFor="mcp-token">API Key / Bearer Token</Label>
            <Input
              id="mcp-token"
              type="password"
              placeholder="Token"
              value={bearerToken}
              onChange={(e) => setBearerToken(e.target.value)}
            />
          </div>
        )}

        {/* Manual fallback (shown when probe fails or server unreachable) */}
        {(probeStatus === "error" ||
          (probeStatus === "done" && !probeResult?.reachable)) && (
          <Collapsible open={showManualAuth} onOpenChange={setShowManualAuth}>
            <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${showManualAuth ? "rotate-0" : "-rotate-90"}`}
              />
              Configure authentication manually
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-3 space-y-3 rounded-md border p-3">
                <div className="space-y-2">
                  <Label htmlFor="manual-token">Bearer Token</Label>
                  <Input
                    id="manual-token"
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
                    <Label htmlFor="manual-header-name">Header Name</Label>
                    <Input
                      id="manual-header-name"
                      placeholder="X-Api-Key"
                      value={manualHeaderName}
                      onChange={(e) => setManualHeaderName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="manual-header-value">Header Value</Label>
                    <Input
                      id="manual-header-value"
                      type="password"
                      placeholder="Value"
                      value={manualHeaderValue}
                      onChange={(e) => setManualHeaderValue(e.target.value)}
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

        <Button
          onClick={handleSubmit}
          disabled={
            !isFormValid ||
            createMutation.isPending ||
            probeStatus === "probing" ||
            (needsToken && !bearerToken && !manualHeaderName)
          }
          className="w-full sm:w-auto"
        >
          {createMutation.isPending && (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          )}
          Connect
        </Button>
      </div>
    </div>
  );
}

function ProbeResultBanner({
  status,
  result,
}: {
  status: ProbeStatus;
  result: MCPProbeResult | null;
}) {
  if (status === "idle" || status === "probing") return null;

  if (!result?.reachable) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-3">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
        <div className="text-sm text-amber-700 dark:text-amber-300">
          <p className="font-medium">Could not reach server</p>
          {result?.error && (
            <p className="text-xs mt-0.5 opacity-80">{result.error}</p>
          )}
          <p className="text-xs mt-1">
            You can still add this source with manual authentication below.
          </p>
        </div>
      </div>
    );
  }

  if (!result.auth_required) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/30 p-3">
        <ShieldCheck className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
        <span className="text-sm text-green-700 dark:text-green-300">
          No authentication required
        </span>
      </div>
    );
  }

  if (result.detected_type === "oauth") {
    return (
      <div className="flex items-start gap-2 rounded-md border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30 p-3">
        <Lock className="h-4 w-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
        <div className="text-sm text-blue-700 dark:text-blue-300">
          <p className="font-medium">OAuth 2.1 authentication detected</p>
          <p className="text-xs mt-0.5 opacity-80">
            After connecting, you&apos;ll be prompted to authorize access.
          </p>
          {result.scopes_supported && result.scopes_supported.length > 0 && (
            <p className="text-xs mt-1 opacity-80">
              Scopes: {result.scopes_supported.join(", ")}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (result.detected_type === "bearer") {
    return (
      <div className="flex items-center gap-2 rounded-md border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-3">
        <Lock className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <span className="text-sm text-amber-700 dark:text-amber-300">
          Authentication required — enter an API key or bearer token below
        </span>
      </div>
    );
  }

  return null;
}

/* ─────────────────── OpenAPI Source Step ─────────────────── */

type OpenAPIProbeStatus = "idle" | "probing" | "done" | "error";
type OpenAPIAuthChoice = "none" | "bearer" | "api_key" | "oauth2_authorization_code";
type SharedCredentialMode = "bearer" | "custom_header";
type OpenAPIInputMode = "url" | "paste";

function detectAuthFromSchemes(
  schemes: Record<string, unknown>,
): OpenAPIAuthChoice {
  for (const scheme of Object.values(schemes)) {
    if (typeof scheme !== "object" || scheme === null) continue;
    const s = scheme as Record<string, unknown>;
    if (s.type === "http" && s.scheme === "bearer") return "bearer";
    if (s.type === "oauth2") {
      const flows = s.flows as Record<string, unknown> | undefined;
      if (flows?.authorizationCode) return "oauth2_authorization_code";
    }
    if (s.type === "apiKey") return "api_key";
  }
  return "none";
}

function describeDetectedSchemes(
  schemes: Record<string, unknown>,
): string {
  const descriptions: string[] = [];
  for (const [name, scheme] of Object.entries(schemes)) {
    if (typeof scheme !== "object" || scheme === null) continue;
    const s = scheme as Record<string, unknown>;
    if (s.type === "http" && s.scheme === "bearer") {
      descriptions.push(`${name} (HTTP Bearer)`);
    } else if (s.type === "oauth2") {
      descriptions.push(`${name} (OAuth 2.1)`);
    } else if (s.type === "apiKey") {
      const loc = s.in === "header" ? "header" : String(s.in || "header");
      descriptions.push(`${name} (API Key in ${loc})`);
    } else if (s.type === "http") {
      descriptions.push(`${name} (HTTP ${String(s.scheme || "")})`);
    }
  }
  return descriptions.length > 0 ? descriptions.join(", ") : "unknown scheme";
}

function FieldLabel({
  htmlFor,
  children,
  tooltip,
  className = "text-xs",
}: {
  htmlFor?: string;
  children: React.ReactNode;
  tooltip?: string;
  className?: string;
}) {
  return (
    <div className="flex items-center gap-1">
      <Label htmlFor={htmlFor} className={className}>
        {children}
      </Label>
      {tooltip && (
        <Tooltip>
          <TooltipTrigger asChild>
            <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-64">
            {tooltip}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

function OpenAPISourceStep({ onBack }: { onBack: () => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { currentProduct } = useProduct();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [inputMode, setInputMode] = useState<OpenAPIInputMode>("url");
  const [name, setName] = useState("");
  const [specUrl, setSpecUrl] = useState("");
  const [specContent, setSpecContent] = useState("");
  const [slug, setSlug] = useState("");

  const [probeStatus, setProbeStatus] = useState<OpenAPIProbeStatus>("idle");
  const [probeResult, setProbeResult] = useState<OpenAPIProbeResult | null>(null);

  const [authType, setAuthType] = useState<OpenAPIAuthChoice>("none");
  const [sharedCredMode, setSharedCredMode] = useState<SharedCredentialMode>("bearer");
  const [bearerToken, setBearerToken] = useState("");
  const [apiKeyHeader, setApiKeyHeader] = useState("X-Api-Key");
  const [apiKeyValue, setApiKeyValue] = useState("");

  const [oauthClientId, setOauthClientId] = useState("");
  const [oauthClientSecret, setOauthClientSecret] = useState("");
  const [oauthAuthEndpoint, setOauthAuthEndpoint] = useState("");
  const [oauthTokenEndpoint, setOauthTokenEndpoint] = useState("");
  const [oauthScopes, setOauthScopes] = useState("");
  const [oauthTokenExchangeUrl, setOauthTokenExchangeUrl] = useState("");
  const [oauthEnvironments, setOauthEnvironments] = useState<Array<{ name: string; extra_scope: string; credential_key?: string }>>([]);
  const [showAdvancedOAuth, setShowAdvancedOAuth] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  const [createdSource, setCreatedSource] = useState<OpenAPIToolSource | null>(null);

  const apiBaseUrl =
    process.env.NEXT_PUBLIC_PILLAR_API_URL || "http://localhost:8003";
  const oauthRedirectUri = `${apiBaseUrl}/api/tools/oauth/callback/`;

  const createMutation = useMutation({
    ...createOpenAPISourceMutation(),
    onSuccess: (source) => {
      setCreatedSource(source);
      queryClient.invalidateQueries({ queryKey: openAPISourceKeys.all });
    },
  });

  const resetProbe = useCallback(() => {
    if (probeStatus !== "idle") {
      setProbeStatus("idle");
      setProbeResult(null);
    }
  }, [probeStatus]);

  const handleProbe = useCallback(async () => {
    const payload =
      inputMode === "url"
        ? { spec_url: specUrl.trim() }
        : { spec_content: specContent };

    if (inputMode === "url" && !specUrl.trim()) return;
    if (inputMode === "paste" && !specContent.trim()) return;

    setProbeStatus("probing");
    setProbeResult(null);
    try {
      const result = await openAPISourcesAPI.probe(payload);
      setProbeResult(result);
      setProbeStatus(result.valid ? "done" : "error");
      if (result.title && !name) setName(result.title);
      if (result.title && !slug) {
        setSlug(
          result.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "_")
            .replace(/^_|_$/g, ""),
        );
      }
      if (result.valid && result.security_schemes) {
        const detectedAuth = detectAuthFromSchemes(result.security_schemes);
        if (detectedAuth === "api_key") {
          setAuthType("bearer");
          setSharedCredMode("custom_header");
        } else if (detectedAuth === "bearer") {
          setAuthType("bearer");
          setSharedCredMode("bearer");
        } else if (detectedAuth !== "none") {
          setAuthType(detectedAuth);
        }
      }
    } catch {
      setProbeStatus("error");
    }
  }, [inputMode, specUrl, specContent, name, slug]);

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result as string;
        setSpecContent(text);
        resetProbe();
      };
      reader.readAsText(file);
      e.target.value = "";
    },
    [resetProbe]
  );

  const handleCopyPrompt = useCallback(() => {
    const sourceName = name || probeResult?.title || "your service";
    const text = [
      `I'm setting up OAuth 2.0 (Authorization Code) for "${sourceName}" in Pillar.`,
      `I need the following values from the service's developer/admin console:`,
      ``,
      `1. Client ID – from a new OAuth application`,
      `2. Client Secret – from the same OAuth application`,
      `3. Authorization Endpoint – the URL users are redirected to for login (e.g. https://auth.example.com/authorize)`,
      `4. Token Endpoint – the URL used to exchange the auth code for a token (e.g. https://auth.example.com/token)`,
      `5. Scopes – space-separated list of permissions needed`,
      ``,
      `Set the redirect URI to: ${oauthRedirectUri}`,
    ].join("\n");

    navigator.clipboard.writeText(text);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  }, [name, probeResult?.title, oauthRedirectUri]);

  const resolvedAuthType: OpenAPIAuthChoice =
    authType === "bearer"
      ? sharedCredMode === "bearer"
        ? "bearer"
        : "api_key"
      : authType;

  const handleSubmit = () => {
    if (!currentProduct?.id) return;

    let authCredentials: Record<string, string> | undefined;
    if (resolvedAuthType === "bearer" && bearerToken) {
      authCredentials = { token: bearerToken };
    } else if (resolvedAuthType === "api_key" && apiKeyValue) {
      authCredentials = { header_name: apiKeyHeader, header_value: apiKeyValue };
    }

    createMutation.mutate({
      name,
      ...(inputMode === "url"
        ? { spec_url: specUrl.trim() }
        : { spec_content: specContent }),
      slug: slug || undefined,
      base_url: probeResult?.server_url || undefined,
      auth_type: resolvedAuthType,
      ...(authCredentials && { auth_credentials: authCredentials }),
      ...(resolvedAuthType === "oauth2_authorization_code" && {
        oauth_client_id: oauthClientId,
        oauth_client_secret: oauthClientSecret,
        oauth_authorization_endpoint: oauthAuthEndpoint,
        oauth_token_endpoint: oauthTokenEndpoint,
        oauth_scopes: oauthScopes,
        ...(oauthTokenExchangeUrl && { oauth_token_exchange_url: oauthTokenExchangeUrl }),
        ...(oauthEnvironments.length > 0 && {
          oauth_environments: oauthEnvironments.filter((e) => e.name.trim()),
        }),
      }),
      product_id: currentProduct.id,
    });
  };

  if (createdSource) {
    return (
      <OpenAPIReviewScreen
        source={createdSource}
        onBack={onBack}
        onDone={() => router.push(`/tools/openapi/${createdSource.id}`)}
      />
    );
  }

  const hasSpecInput =
    inputMode === "url" ? !!specUrl.trim() : !!specContent.trim();
  const isFormValid = name.trim() && hasSpecInput && probeStatus === "done";

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2">
        <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
        Back
      </Button>

      {/* ── Phase 1: Spec Validation ── */}
      <div className="space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-semibold">
            Connect OpenAPI Spec
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Provide an OpenAPI spec URL or paste the content directly.
          </p>
        </div>

        <div className="space-y-2">
          <div className="inline-flex rounded-lg border bg-muted/50 p-0.5">
            {(
              [
                ["url", "URL"],
                ["paste", "Paste / Upload"],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => {
                  if (inputMode !== mode) {
                    setInputMode(mode);
                    resetProbe();
                  }
                }}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${
                  inputMode === mode
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {inputMode === "url" ? (
            <div className="flex gap-2">
              <Input
                id="openapi-url"
                type="url"
                placeholder="https://api.example.com/openapi.json"
                value={specUrl}
                onChange={(e) => {
                  setSpecUrl(e.target.value);
                  resetProbe();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && specUrl.trim()) {
                    e.preventDefault();
                    handleProbe();
                  }
                }}
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={handleProbe}
                disabled={!specUrl.trim() || probeStatus === "probing"}
                className="shrink-0"
              >
                {probeStatus === "probing" ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Search className="mr-1.5 h-3.5 w-3.5" />
                )}
                Check
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Textarea
                placeholder="Paste your OpenAPI spec (JSON or YAML)..."
                value={specContent}
                onChange={(e) => {
                  setSpecContent(e.target.value);
                  resetProbe();
                }}
                rows={10}
                className="font-mono text-xs"
              />
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="shrink-0"
                >
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                  Upload file
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.yaml,.yml"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  onClick={handleProbe}
                  disabled={!specContent.trim() || probeStatus === "probing"}
                  className="shrink-0"
                >
                  {probeStatus === "probing" ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Search className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Check
                </Button>
                {specContent && (
                  <span className="text-xs text-muted-foreground ml-auto">
                    {(specContent.length / 1024).toFixed(1)} KB
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {probeStatus === "done" && probeResult?.valid && (
          <div className="flex items-start gap-2 rounded-md border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/30 p-3">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-green-600 dark:text-green-400" />
            <div className="text-sm text-green-700 dark:text-green-300">
              <p className="font-medium">
                Valid spec — {probeResult.operation_count} operations found
              </p>
              {probeResult.version && (
                <p className="text-xs mt-0.5 opacity-80">
                  v{probeResult.version}
                  {probeResult.server_url && ` · ${probeResult.server_url}`}
                </p>
              )}
            </div>
          </div>
        )}

        {probeStatus === "error" && (
          <div className="flex items-start gap-2 rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-3">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
            <div className="text-sm text-red-700 dark:text-red-300">
              <p className="font-medium">Invalid spec</p>
              {probeResult?.error && (
                <p className="text-xs mt-0.5 opacity-80">{probeResult.error}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Phase 2: Authentication (visible after successful probe) ── */}
      {probeStatus === "done" && probeResult?.valid && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold">Authentication</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              How should Pillar authenticate when calling this API?
            </p>
          </div>

          {probeResult.security_schemes &&
            Object.keys(probeResult.security_schemes).length > 0 && (
              <div className="rounded-md border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30 p-3">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  <span className="font-medium">Detected from spec:</span>{" "}
                  {describeDetectedSchemes(probeResult.security_schemes)}.
                  This describes the credential format the API expects, not how
                  credentials are obtained. If your service supports OAuth,
                  choose Per-user OAuth 2.1.
                </p>
              </div>
            )}

          <div className="space-y-2">
            {/* No authentication */}
            <button
              type="button"
              onClick={() => setAuthType("none")}
              className={`w-full rounded-md border p-3 text-left transition-colors ${
                authType === "none"
                  ? "border-primary bg-primary/5"
                  : "hover:bg-muted/50"
              }`}
            >
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">No authentication</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 ml-6">
                This API is publicly accessible — no credentials needed.
              </p>
            </button>

            {/* Shared credential */}
            <button
              type="button"
              onClick={() => setAuthType("bearer")}
              className={`w-full rounded-md border p-3 text-left transition-colors ${
                authType === "bearer"
                  ? "border-primary bg-primary/5"
                  : "hover:bg-muted/50"
              }`}
            >
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Shared credential</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 ml-6">
                You provide a single API key or token. All tool calls use this
                credential.
              </p>
            </button>

            {authType === "bearer" && (
              <div className="ml-6 space-y-3 rounded-md border p-3 bg-muted/30">
                <div className="space-y-2">
                  <Label className="text-xs">Credential format</Label>
                  <RadioGroup
                    value={sharedCredMode}
                    onValueChange={(v) => setSharedCredMode(v as SharedCredentialMode)}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="bearer" id="cred-bearer" />
                      <Label htmlFor="cred-bearer" className="text-xs font-normal cursor-pointer">
                        Bearer token
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="custom_header" id="cred-header" />
                      <Label htmlFor="cred-header" className="text-xs font-normal cursor-pointer">
                        Custom header
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {sharedCredMode === "bearer" ? (
                  <div className="space-y-2">
                    <Label htmlFor="openapi-bearer" className="text-xs">
                      Bearer Token
                    </Label>
                    <Input
                      id="openapi-bearer"
                      type="password"
                      placeholder="Token"
                      value={bearerToken}
                      onChange={(e) => setBearerToken(e.target.value)}
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="openapi-apikey-header" className="text-xs">
                        Header Name
                      </Label>
                      <Input
                        id="openapi-apikey-header"
                        placeholder="X-Api-Key"
                        value={apiKeyHeader}
                        onChange={(e) => setApiKeyHeader(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="openapi-apikey-value" className="text-xs">
                        API Key
                      </Label>
                      <Input
                        id="openapi-apikey-value"
                        type="password"
                        placeholder="Key"
                        value={apiKeyValue}
                        onChange={(e) => setApiKeyValue(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                <p className="text-xs text-amber-600 dark:text-amber-400">
                  All users share this credential. If each user needs their own
                  token, choose Per-user OAuth 2.1 instead.
                </p>
              </div>
            )}

            {/* Per-user OAuth 2.1 */}
            <button
              type="button"
              onClick={() => setAuthType("oauth2_authorization_code")}
              className={`w-full rounded-md border p-3 text-left transition-colors ${
                authType === "oauth2_authorization_code"
                  ? "border-primary bg-primary/5"
                  : "hover:bg-muted/50"
              }`}
            >
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  Per-user OAuth 2.1
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 ml-6">
                Each user authorizes individually through your service&apos;s
                OAuth flow. Users on Slack, Discord, or other channels will be
                prompted to connect their account.
              </p>
            </button>

            {authType === "oauth2_authorization_code" && (
              <div className="ml-6 space-y-4 rounded-md border p-3 bg-muted/30">
                <div className="rounded-md bg-background border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium">
                      Setup instructions
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1.5"
                      onClick={handleCopyPrompt}
                    >
                      <ClipboardCopy className="h-3 w-3" />
                      {copiedPrompt ? "Copied!" : "Copy to prompt"}
                    </Button>
                  </div>
                  <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
                    <li>
                      Go to your service&apos;s developer or admin console
                    </li>
                    <li>
                      Create a new OAuth application (or &quot;client&quot;).
                      Name it something your users will recognize, like
                      &quot;[Your Product] AI Assistant&quot; &mdash; this appears
                      on the consent screen when users connect their account.
                    </li>
                    <li>
                      Set the redirect URI to:{" "}
                      <code className="px-1 py-0.5 rounded bg-muted text-foreground font-mono text-[11px] select-all">
                        {oauthRedirectUri}
                      </code>
                    </li>
                    <li>Copy the client ID and client secret below</li>
                    <li>
                      Enter your authorization and token endpoint URLs
                    </li>
                  </ol>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <FieldLabel
                      tooltip="The unique identifier for the OAuth application you created in the service's developer console."
                    >
                      Client ID
                    </FieldLabel>
                    <Input
                      placeholder="Client ID"
                      value={oauthClientId}
                      onChange={(e) => setOauthClientId(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <FieldLabel
                      tooltip="The secret key paired with your Client ID. Keep this confidential."
                    >
                      Client Secret
                    </FieldLabel>
                    <Input
                      type="password"
                      placeholder="Leave blank to keep current"
                      value={oauthClientSecret}
                      onChange={(e) => setOauthClientSecret(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <FieldLabel
                    tooltip="The URL where users are redirected to log in and grant access. Usually found in the service's OAuth documentation."
                  >
                    Authorization Endpoint
                  </FieldLabel>
                  <Input
                    type="url"
                    placeholder="https://auth.example.com/authorize"
                    value={oauthAuthEndpoint}
                    onChange={(e) => setOauthAuthEndpoint(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel
                    tooltip="The URL used to exchange the authorization code for an access token. Found in the service's OAuth documentation."
                  >
                    Token Endpoint
                  </FieldLabel>
                  <Input
                    type="url"
                    placeholder="https://auth.example.com/token"
                    value={oauthTokenEndpoint}
                    onChange={(e) => setOauthTokenEndpoint(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel
                    tooltip="Space-separated list of permissions to request. These control what actions the token can perform."
                  >
                    Scopes
                  </FieldLabel>
                  <Input
                    placeholder="read write (space-separated)"
                    value={oauthScopes}
                    onChange={(e) => setOauthScopes(e.target.value)}
                  />
                </div>

                <Collapsible open={showAdvancedOAuth} onOpenChange={setShowAdvancedOAuth}>
                  <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform ${showAdvancedOAuth ? "rotate-0" : "-rotate-90"}`}
                    />
                    Advanced settings
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-3 space-y-4">
                      <div className="space-y-2">
                        <FieldLabel
                          tooltip="After OAuth completes, Pillar will POST the access token to this URL to provision an API key. Leave empty to use the OAuth access token directly for API calls."
                        >
                          Token Exchange URL
                        </FieldLabel>
                        <Input
                          placeholder="e.g. /cli/api-keys or https://api.example.com/keys"
                          value={oauthTokenExchangeUrl}
                          onChange={(e) => setOauthTokenExchangeUrl(e.target.value)}
                          className="font-mono text-xs"
                        />
                      </div>

                      <div className="space-y-2">
                        <FieldLabel
                          tooltip="Define named environments (e.g. Sandbox, Live) that append extra scopes to the OAuth request. Users pick an environment when authenticating."
                        >
                          OAuth Environments
                        </FieldLabel>
                        {oauthEnvironments.map((env, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <Input
                              value={env.name}
                              onChange={(e) => {
                                const updated = [...oauthEnvironments];
                                updated[idx] = { ...updated[idx], name: e.target.value };
                                setOauthEnvironments(updated);
                              }}
                              placeholder="Name (e.g. Sandbox)"
                              className="flex-1"
                            />
                            <Input
                              value={env.extra_scope}
                              onChange={(e) => {
                                const updated = [...oauthEnvironments];
                                updated[idx] = { ...updated[idx], extra_scope: e.target.value };
                                setOauthEnvironments(updated);
                              }}
                              placeholder="Extra scope (e.g. env:sandbox)"
                              className="flex-1 font-mono text-xs"
                            />
                            <Input
                              value={env.credential_key ?? ""}
                              onChange={(e) => {
                                const updated = [...oauthEnvironments];
                                updated[idx] = { ...updated[idx], credential_key: e.target.value };
                                setOauthEnvironments(updated);
                              }}
                              placeholder="Response key (e.g. sandbox_key)"
                              className="flex-1 font-mono text-xs"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0"
                              onClick={() => setOauthEnvironments(oauthEnvironments.filter((_, i) => i !== idx))}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setOauthEnvironments([...oauthEnvironments, { name: "", extra_scope: "", credential_key: "" }])}
                        >
                          <Plus className="mr-1.5 h-3.5 w-3.5" />
                          Add Environment
                        </Button>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Phase 3: Naming (visible after successful probe) ── */}
      {probeStatus === "done" && probeResult?.valid && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold">Naming</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Display name and tool namespace for this source.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="openapi-name" className="text-xs">
              Display Name
            </Label>
            <Input
              id="openapi-name"
              placeholder="e.g. Acme API"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="openapi-slug" className="text-xs">
              Slug (namespace)
            </Label>
            <Input
              id="openapi-slug"
              placeholder="acme"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Tool names will be prefixed with this slug
            </p>
          </div>
        </div>
      )}

      {createMutation.isError && (
        <div className="flex items-start gap-2 text-sm text-red-500">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            {createMutation.error instanceof Error
              ? createMutation.error.message
              : "Failed to create OpenAPI source"}
          </span>
        </div>
      )}

      <Button
        onClick={handleSubmit}
        disabled={!isFormValid || createMutation.isPending}
        className="w-full sm:w-auto"
      >
        {createMutation.isPending && (
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        )}
        Connect
      </Button>
    </div>
  );
}

/* ─────────────────── OpenAPI Review Screen ─────────────────── */

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  POST: "bg-green-500/10 text-green-600 dark:text-green-400",
  PUT: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  PATCH: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  DELETE: "bg-red-500/10 text-red-600 dark:text-red-400",
};

function MCPReviewScreen({ source }: { source: MCPToolSource }) {
  const [configs, setConfigs] = useState<MCPToolConfigItem[]>(() =>
    source.tool_configs || [],
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const configMap = new Map(configs.map((c) => [c.tool_name, c]));

  const toggleEnabled = (toolName: string) => {
    setConfigs((prev) =>
      prev.map((c) =>
        c.tool_name === toolName ? { ...c, is_enabled: !c.is_enabled } : c,
      ),
    );
    setIsDirty(true);
  };

  const toggleConfirmation = (toolName: string) => {
    setConfigs((prev) =>
      prev.map((c) =>
        c.tool_name === toolName
          ? { ...c, requires_confirmation: !c.requires_confirmation }
          : c,
      ),
    );
    setIsDirty(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updates = configs.map((c) => ({
        tool_name: c.tool_name,
        is_enabled: c.is_enabled,
        requires_confirmation: c.requires_confirmation,
      }));
      await mcpSourcesAPI.updateToolConfigs(source.id, updates);
      setIsDirty(false);
    } finally {
      setIsSaving(false);
    }
  };

  const enabledCount = configs.filter((c) => c.is_enabled).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {enabledCount}/{configs.length} tools enabled
        </p>
        {isDirty && (
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving…" : "Save Changes"}
          </Button>
        )}
      </div>
      <ScrollArea className="max-h-48">
        <div className="rounded-md border divide-y">
          {source.discovered_tools.map((tool) => {
            const cfg = configMap.get(tool.name);
            const isEnabled = cfg?.is_enabled ?? true;
            const requiresConfirmation = cfg?.requires_confirmation ?? false;
            return (
              <div key={tool.name} className="px-3 py-2 flex items-center gap-2">
                <Switch
                  checked={isEnabled}
                  onCheckedChange={() => toggleEnabled(tool.name)}
                  className="h-4 w-7 [&>span]:h-3 [&>span]:w-3 [&>span]:data-[state=checked]:translate-x-3 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium">{tool.name}</span>
                  {tool.description && (
                    <p className="text-xs text-muted-foreground truncate">
                      {tool.description}
                    </p>
                  )}
                </div>
                {isEnabled && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        className={`h-5 px-1.5 rounded text-[10px] font-medium shrink-0 ${
                          requiresConfirmation
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                            : "bg-muted text-muted-foreground"
                        }`}
                        onClick={() => toggleConfirmation(tool.name)}
                      >
                        {requiresConfirmation ? "Confirm" : "Auto"}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="text-xs max-w-[200px]">
                      {requiresConfirmation
                        ? "Requires user confirmation before execution"
                        : "Executes automatically without confirmation"}
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}


function OpenAPIReviewScreen({
  source,
  onBack,
  onDone,
}: {
  source: OpenAPIToolSource;
  onBack: () => void;
  onDone: () => void;
}) {
  const isSuccess = source.discovery_status === "success";

  const [configs, setConfigs] = useState<OpenAPIOperationConfigItem[]>(() =>
    source.operation_configs || [],
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const configMap = new Map(configs.map((c) => [c.tool_name, c]));

  const toggleEnabled = (operationId: string) => {
    setConfigs((prev) =>
      prev.map((c) =>
        c.tool_name === operationId ? { ...c, is_enabled: !c.is_enabled } : c,
      ),
    );
    setIsDirty(true);
  };

  const toggleConfirmation = (operationId: string) => {
    setConfigs((prev) =>
      prev.map((c) =>
        c.tool_name === operationId
          ? { ...c, requires_confirmation: !c.requires_confirmation }
          : c,
      ),
    );
    setIsDirty(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updates = configs.map((c) => ({
        tool_name: c.tool_name,
        is_enabled: c.is_enabled,
        requires_confirmation: c.requires_confirmation,
      }));
      await openAPISourcesAPI.updateOperationConfigs(source.id, updates);
      onDone();
    } catch {
      setIsSaving(false);
    }
  };

  if (!isSuccess) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2">
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
          Back
        </Button>
        <div>
          <h2 className="text-base sm:text-lg font-semibold">Source Added</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {source.discovery_status === "pending"
              ? `${source.name} was added — discovery is still running.`
              : `${source.name} was added but spec parsing failed.`}
          </p>
        </div>
        {source.discovery_status === "error" && source.discovery_error && (
          <div className="flex items-start gap-2 text-sm text-red-500 rounded-md border border-red-200 dark:border-red-900 p-3">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{source.discovery_error}</span>
          </div>
        )}
        <Button onClick={onDone} className="w-full sm:w-auto">
          View Source
        </Button>
      </div>
    );
  }

  const enabledCount = configs.filter((c) => c.is_enabled).length;
  const confirmCount = configs.filter((c) => c.requires_confirmation).length;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2">
        <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
        Back
      </Button>

      <div>
        <h2 className="text-base sm:text-lg font-semibold">Review Operations</h2>
        <p className="text-xs sm:text-sm text-muted-foreground">
          {source.operation_count} operations discovered from {source.name}.
          Toggle which operations are enabled and which require user confirmation before execution.
        </p>
      </div>

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span>{enabledCount} of {configs.length} enabled</span>
        <span>{confirmCount} require confirmation</span>
      </div>

      <ScrollArea className={configs.length > 10 ? "h-[400px]" : undefined}>
        <div className="rounded-md border divide-y">
          {source.discovered_operations.map((op) => {
            const cfg = configMap.get(op.operation_id);
            const isEnabled = cfg?.is_enabled ?? true;
            const requiresConfirm = cfg?.requires_confirmation ?? false;
            const methodColor = METHOD_COLORS[op.method.toUpperCase()] || "bg-muted text-muted-foreground";

            return (
              <div
                key={op.operation_id}
                className={`flex items-center gap-3 px-3 py-2 transition-opacity ${
                  !isEnabled ? "opacity-40" : ""
                }`}
              >
                <Switch
                  checked={isEnabled}
                  onCheckedChange={() => toggleEnabled(op.operation_id)}
                  className="h-4 w-7 shrink-0 [&>span]:h-3 [&>span]:w-3 [&>span]:data-[state=checked]:translate-x-3"
                />
                <span
                  className={`text-[10px] font-mono font-semibold uppercase px-1.5 py-0.5 rounded shrink-0 w-14 text-center ${methodColor}`}
                >
                  {op.method}
                </span>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-mono truncate block">
                    {op.path}
                  </span>
                  {op.summary && (
                    <p className="text-xs text-muted-foreground truncate">
                      {op.summary}
                    </p>
                  )}
                </div>
                {isEnabled && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => toggleConfirmation(op.operation_id)}
                        className={`shrink-0 inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium transition-colors cursor-pointer ${
                          requiresConfirm
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800 hover:bg-amber-500/20"
                            : "bg-muted/50 text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        {requiresConfirm ? (
                          <ShieldCheck className="h-3 w-3" />
                        ) : (
                          <Zap className="h-3 w-3" />
                        )}
                        {requiresConfirm ? "Confirm" : "Auto"}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="text-xs max-w-48">
                      {requiresConfirm
                        ? "User must confirm before this operation runs. Click to disable."
                        : "Runs without confirmation. Click to require confirmation."}
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>

      <div className="flex gap-2">
        <Button variant="outline" onClick={onDone}>
          Skip
        </Button>
        <Button onClick={handleSave} disabled={isSaving || !isDirty}>
          {isSaving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          Save & Continue
        </Button>
      </div>
    </div>
  );
}
