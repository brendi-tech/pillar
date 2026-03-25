"use client";

import {
  DetailHeader,
  DetailPageShell,
  MetadataStrip,
  SectionLabel,
} from "@/components/shared";
import type { MetadataItem } from "@/components/shared";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  openAPISourceDetailQuery,
  openAPISourceKeys,
  openAPISourceVersionsQuery,
  refreshOpenAPISourceMutation,
  updateOpenAPISourceMutation,
  updateOperationConfigsMutation,
  deleteOpenAPISourceMutation,
} from "@/queries/openAPISource.queries";
import type {
  OpenAPIAuthType,
  OpenAPIOperation,
  OpenAPIToolSource,
  OpenAPIToolSourceVersion,
} from "@/types/openAPISource";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  ChevronDown,
  ChevronRight,
  Clock,
  Globe,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

interface OpenAPISourceDetailPageProps {
  sourceId: string;
}

const AUTH_TYPE_LABELS: Record<string, string> = {
  none: "No Auth",
  api_key: "API Key",
  bearer: "Bearer Token",
  oauth2_client_credentials: "OAuth 2.0 (Client Credentials)",
  oauth2_authorization_code: "OAuth 2.0 (Authorization Code)",
};

const AUTH_TYPE_OPTIONS: { value: OpenAPIAuthType; label: string }[] = [
  { value: "none", label: "No Auth" },
  { value: "api_key", label: "API Key" },
  { value: "bearer", label: "Bearer Token" },
  { value: "oauth2_client_credentials", label: "OAuth 2.0 (Client Credentials)" },
  { value: "oauth2_authorization_code", label: "OAuth 2.0 (Authorization Code)" },
];

const STATUS_VARIANTS: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  success: "default",
  pending: "secondary",
  error: "destructive",
};

const METHOD_COLORS: Record<string, string> = {
  get: "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900",
  post: "text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900",
  put: "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900",
  patch: "text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-900",
  delete: "text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900",
};

export function OpenAPISourceDetailPage({
  sourceId,
}: OpenAPISourceDetailPageProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  const {
    data: source,
    isLoading,
    error,
    refetch,
  } = useQuery(openAPISourceDetailQuery(sourceId));

  const activeOp = useMemo(() => {
    const opId = searchParams.get("op");
    if (!opId) return null;
    return opId;
  }, [searchParams]);

  const refreshMutation = useMutation({
    ...refreshOpenAPISourceMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: openAPISourceKeys.all });
      toast.success("Spec re-parsed successfully");
    },
    onError: () => {
      toast.error("Failed to refresh spec");
    },
  });

  const deleteMutation = useMutation({
    ...deleteOpenAPISourceMutation(),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: openAPISourceKeys.detail(sourceId) });
      queryClient.removeQueries({ queryKey: openAPISourceKeys.versions(sourceId) });
      queryClient.invalidateQueries({ queryKey: openAPISourceKeys.lists() });
      toast.success("API source deleted");
      router.push("/tools");
    },
    onError: () => {
      toast.error("Failed to delete API source");
    },
  });

  const isPasted = source?.has_spec_content && !source?.spec_url;

  const metadataItems: MetadataItem[] = source
    ? [
        ...(isPasted
          ? [
              {
                label: "Spec Source",
                value: "Pasted content",
                colSpan: 2,
              } as MetadataItem,
            ]
          : [
              {
                label: "Spec URL",
                value: source.spec_url,
                colSpan: 2,
                allowWrap: true,
              } as MetadataItem,
            ]),
        {
          label: "Base URL",
          value: source.base_url || "From spec",
        },
        {
          label: "Authentication",
          value: AUTH_TYPE_LABELS[source.auth_type] ?? source.auth_type,
        },
        {
          label: "Operations",
          value: String(source.operation_count),
        },
        {
          label: "Spec Version",
          value: source.current_version_display || source.spec_version || "Unknown",
        },
        {
          label: "Last Parsed",
          value: source.last_discovery_at
            ? formatDistanceToNow(new Date(source.last_discovery_at), {
                addSuffix: true,
              })
            : "Never",
        },
        ...(source.consecutive_failures > 0
          ? [
              {
                label: "Consecutive Failures",
                value: String(source.consecutive_failures),
              } as MetadataItem,
            ]
          : []),
      ]
    : [];

  const overviewHref = `/tools/openapi/${sourceId}`;

  return (
    <DetailPageShell
      isLoading={isLoading}
      error={error ?? null}
      isEmpty={!source && !isLoading && !error}
      emptyTitle="Source not found"
      emptyDescription="Select an API source from the sidebar to view its details."
      onRetry={refetch}
    >
      {source && (
        <>
          {activeOp ? (
            <OperationDetailView
              source={source}
              operationId={activeOp}
              overviewHref={overviewHref}
            />
          ) : (
            <SourceOverview
              source={source}
              sourceId={sourceId}
              metadataItems={metadataItems}
              refreshMutation={refreshMutation}
              deleteMutation={deleteMutation}
            />
          )}
        </>
      )}
    </DetailPageShell>
  );
}

function SourceOverview({
  source,
  sourceId,
  metadataItems,
  refreshMutation,
  deleteMutation,
}: {
  source: OpenAPIToolSource;
  sourceId: string;
  metadataItems: MetadataItem[];
  refreshMutation: { mutate: (id: string) => void; isPending: boolean };
  deleteMutation: { mutate: (id: string) => void; isPending: boolean };
}) {
  const isPasted = source.has_spec_content && !source.spec_url;

  return (
    <>
      <DetailHeader
        title={source.name}
        subtitle={source.slug}
        subtitleMono
        icon={<Globe className="h-5 w-5" />}
        badges={
          <>
            <Badge
              variant={
                STATUS_VARIANTS[source.discovery_status] ?? "secondary"
              }
            >
              {source.discovery_status}
            </Badge>
            <Badge variant="outline">
              {AUTH_TYPE_LABELS[source.auth_type] ?? source.auth_type}
            </Badge>
            {source.spec_format && (
              <Badge variant="outline">
                {source.spec_format.toUpperCase()}
              </Badge>
            )}
            {isPasted && (
              <Badge variant="outline">Pasted</Badge>
            )}
            {source.current_version_display && (
              <Badge variant="outline">
                {source.current_version_display}
              </Badge>
            )}
          </>
        }
        actions={
          <div className="flex items-center gap-2">
            {!isPasted && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => refreshMutation.mutate(source.id)}
                disabled={refreshMutation.isPending}
              >
                {refreshMutation.isPending ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                )}
                Re-fetch
              </Button>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete API Source</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently remove &ldquo;{source.name}&rdquo;
                    and detach it from all agents. User credentials linked to
                    this source will also be removed.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteMutation.mutate(source.id)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deleteMutation.isPending ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        }
      />

      {source.discovery_status === "error" && source.discovery_error && (
        <div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400 rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-3">
          <span className="font-medium shrink-0">Discovery error:</span>
          <span>{source.discovery_error}</span>
        </div>
      )}

      {metadataItems.length > 0 && <MetadataStrip items={metadataItems} />}

      <SettingsSection source={source} sourceId={sourceId} />

      <SpecSourceSection source={source} sourceId={sourceId} />

      <VersionHistorySection sourceId={sourceId} />

      <DiscoveredOperationsSection
        operations={source.discovered_operations}
        sourceId={sourceId}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Settings Section (auth + basic config)
// ---------------------------------------------------------------------------

function SettingsSection({
  source,
  sourceId,
}: {
  source: OpenAPIToolSource;
  sourceId: string;
}) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState({
    name: source.name,
    base_url: source.base_url,
    auth_type: source.auth_type as OpenAPIAuthType,
    oauth_client_id: source.oauth_client_id,
    oauth_client_secret: "",
    oauth_authorization_endpoint: source.oauth_authorization_endpoint,
    oauth_token_endpoint: source.oauth_token_endpoint,
    oauth_scopes: source.oauth_scopes,
    oauth_environments: source.oauth_environments ?? [],
    oauth_token_exchange_url: source.oauth_token_exchange_url ?? "",
  });

  const resetDraft = useCallback(() => {
    setDraft({
      name: source.name,
      base_url: source.base_url,
      auth_type: source.auth_type as OpenAPIAuthType,
      oauth_client_id: source.oauth_client_id,
      oauth_client_secret: "",
      oauth_authorization_endpoint: source.oauth_authorization_endpoint,
      oauth_token_endpoint: source.oauth_token_endpoint,
      oauth_scopes: source.oauth_scopes,
      oauth_environments: source.oauth_environments ?? [],
      oauth_token_exchange_url: source.oauth_token_exchange_url ?? "",
    });
  }, [source]);

  const updateMutation = useMutation({
    ...updateOpenAPISourceMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: openAPISourceKeys.all });
      toast.success("Settings saved");
    },
    onError: () => {
      toast.error("Failed to save settings");
    },
  });

  const handleSave = () => {
    const payload: Record<string, unknown> = {};
    if (draft.name !== source.name) payload.name = draft.name;
    if (draft.base_url !== source.base_url) payload.base_url = draft.base_url;
    if (draft.auth_type !== source.auth_type) payload.auth_type = draft.auth_type;
    if (draft.oauth_client_id !== source.oauth_client_id) payload.oauth_client_id = draft.oauth_client_id;
    if (draft.oauth_client_secret) payload.oauth_client_secret = draft.oauth_client_secret;
    if (draft.oauth_authorization_endpoint !== source.oauth_authorization_endpoint)
      payload.oauth_authorization_endpoint = draft.oauth_authorization_endpoint;
    if (draft.oauth_token_endpoint !== source.oauth_token_endpoint)
      payload.oauth_token_endpoint = draft.oauth_token_endpoint;
    if (draft.oauth_scopes !== source.oauth_scopes) payload.oauth_scopes = draft.oauth_scopes;
    if (JSON.stringify(draft.oauth_environments) !== JSON.stringify(source.oauth_environments ?? []))
      payload.oauth_environments = draft.oauth_environments;
    if (draft.oauth_token_exchange_url !== (source.oauth_token_exchange_url ?? ""))
      payload.oauth_token_exchange_url = draft.oauth_token_exchange_url;

    if (Object.keys(payload).length === 0) {
      toast.info("No changes to save");
      return;
    }
    updateMutation.mutate({ id: sourceId, data: payload as any });
  };

  const isOAuth = draft.auth_type === "oauth2_authorization_code" || draft.auth_type === "oauth2_client_credentials";

  return (
    <div className="rounded-md border">
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors"
        onClick={() => { setExpanded(!expanded); if (!expanded) resetDraft(); }}
      >
        <span className="flex items-center gap-2">
          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
          Settings
        </span>
        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>

      {expanded && (
        <div className="border-t px-4 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="base_url">Base URL</Label>
              <Input
                id="base_url"
                value={draft.base_url}
                onChange={(e) => setDraft({ ...draft, base_url: e.target.value })}
                placeholder="From spec"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Authentication Type</Label>
            <Select
              value={draft.auth_type}
              onValueChange={(v) => setDraft({ ...draft, auth_type: v as OpenAPIAuthType })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AUTH_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isOAuth && (
            <div className="space-y-4 rounded-md border p-3 bg-muted/20">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="oauth_client_id">Client ID</Label>
                  <Input
                    id="oauth_client_id"
                    value={draft.oauth_client_id}
                    onChange={(e) => setDraft({ ...draft, oauth_client_id: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="oauth_client_secret">Client Secret</Label>
                  <Input
                    id="oauth_client_secret"
                    type="password"
                    value={draft.oauth_client_secret}
                    onChange={(e) => setDraft({ ...draft, oauth_client_secret: e.target.value })}
                    placeholder="Leave blank to keep current"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="oauth_auth_endpoint">Authorization Endpoint</Label>
                  <Input
                    id="oauth_auth_endpoint"
                    value={draft.oauth_authorization_endpoint}
                    onChange={(e) => setDraft({ ...draft, oauth_authorization_endpoint: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="oauth_token_endpoint">Token Endpoint</Label>
                  <Input
                    id="oauth_token_endpoint"
                    value={draft.oauth_token_endpoint}
                    onChange={(e) => setDraft({ ...draft, oauth_token_endpoint: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="oauth_scopes">Scopes (space-separated)</Label>
                <Textarea
                  id="oauth_scopes"
                  value={draft.oauth_scopes}
                  onChange={(e) => setDraft({ ...draft, oauth_scopes: e.target.value })}
                  rows={2}
                  className="font-mono text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="oauth_token_exchange_url">Token Exchange URL</Label>
                <Input
                  id="oauth_token_exchange_url"
                  value={draft.oauth_token_exchange_url}
                  onChange={(e) => setDraft({ ...draft, oauth_token_exchange_url: e.target.value })}
                  placeholder="e.g. /cli/api-keys or https://api.example.com/keys"
                  className="font-mono text-xs"
                />
                <p className="text-[11px] text-muted-foreground">
                  After OAuth, POST to this URL with the access token to provision API keys. Leave empty to use the OAuth token directly.
                </p>
              </div>

              <div className="space-y-2">
                <Label>OAuth Environments</Label>
                <p className="text-xs text-muted-foreground">
                  Define environments (e.g. Sandbox, Live) that append extra scopes to the OAuth request. Users will be asked to pick an environment when authenticating.
                </p>
                {draft.oauth_environments.map((env, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      value={env.name}
                      onChange={(e) => {
                        const updated = [...draft.oauth_environments];
                        updated[idx] = { ...updated[idx], name: e.target.value };
                        setDraft({ ...draft, oauth_environments: updated });
                      }}
                      placeholder="Name (e.g. Sandbox)"
                      className="flex-1"
                    />
                    <Input
                      value={env.extra_scope}
                      onChange={(e) => {
                        const updated = [...draft.oauth_environments];
                        updated[idx] = { ...updated[idx], extra_scope: e.target.value };
                        setDraft({ ...draft, oauth_environments: updated });
                      }}
                      placeholder="Extra scope (e.g. env:sandbox)"
                      className="flex-1 font-mono text-xs"
                    />
                    <Input
                      value={env.credential_key ?? ""}
                      onChange={(e) => {
                        const updated = [...draft.oauth_environments];
                        updated[idx] = { ...updated[idx], credential_key: e.target.value };
                        setDraft({ ...draft, oauth_environments: updated });
                      }}
                      placeholder="Response key (e.g. sandbox_key)"
                      className="flex-1 font-mono text-xs"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => {
                        const updated = draft.oauth_environments.filter((_, i) => i !== idx);
                        setDraft({ ...draft, oauth_environments: updated });
                      }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      oauth_environments: [...draft.oauth_environments, { name: "", extra_scope: "", credential_key: "" }],
                    })
                  }
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Add Environment
                </Button>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => { resetDraft(); setExpanded(false); }}>
              <X className="mr-1.5 h-3.5 w-3.5" />
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="mr-1.5 h-3.5 w-3.5" />
              )}
              Save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Spec Source Section (update URL or paste new content)
// ---------------------------------------------------------------------------

function SpecSourceSection({
  source,
  sourceId,
}: {
  source: OpenAPIToolSource;
  sourceId: string;
}) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"idle" | "url" | "paste">("idle");
  const [specUrl, setSpecUrl] = useState(source.spec_url || "");
  const [specContent, setSpecContent] = useState("");

  const updateMutation = useMutation({
    ...updateOpenAPISourceMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: openAPISourceKeys.all });
      toast.success("Spec updated and re-parsed");
      setMode("idle");
      setSpecContent("");
    },
    onError: () => {
      toast.error("Failed to update spec");
    },
  });

  const isPasted = source.has_spec_content && !source.spec_url;

  const handleSaveUrl = () => {
    if (!specUrl.trim()) {
      toast.error("URL is required");
      return;
    }
    updateMutation.mutate({
      id: sourceId,
      data: { spec_url: specUrl.trim(), spec_content: "" },
    });
  };

  const handleSavePaste = () => {
    if (!specContent.trim()) {
      toast.error("Spec content is required");
      return;
    }
    updateMutation.mutate({
      id: sourceId,
      data: { spec_content: specContent.trim(), spec_url: "" },
    });
  };

  return (
    <div>
      <SectionLabel>Spec Source</SectionLabel>
      <div className="rounded-md border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {isPasted ? "Content was pasted directly" : source.spec_url}
          </p>
          {mode === "idle" && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setMode("url"); setSpecUrl(source.spec_url || ""); }}
              >
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                {isPasted ? "Switch to URL" : "Update URL"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setMode("paste"); setSpecContent(""); }}
              >
                <Upload className="mr-1.5 h-3.5 w-3.5" />
                {isPasted ? "Re-paste" : "Paste Content"}
              </Button>
            </div>
          )}
        </div>

        {mode === "url" && (
          <div className="space-y-3 pt-2 border-t">
            <div className="space-y-1.5">
              <Label htmlFor="new_spec_url">Spec URL</Label>
              <Input
                id="new_spec_url"
                value={specUrl}
                onChange={(e) => setSpecUrl(e.target.value)}
                placeholder="https://api.example.com/openapi.json"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setMode("idle")}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSaveUrl} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="mr-1.5 h-3.5 w-3.5" />
                )}
                Save &amp; Parse
              </Button>
            </div>
          </div>
        )}

        {mode === "paste" && (
          <div className="space-y-3 pt-2 border-t">
            <div className="space-y-1.5">
              <Label htmlFor="new_spec_content">OpenAPI Spec (JSON or YAML)</Label>
              <Textarea
                id="new_spec_content"
                value={specContent}
                onChange={(e) => setSpecContent(e.target.value)}
                rows={10}
                className="font-mono text-xs"
                placeholder="Paste your OpenAPI spec here..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setMode("idle")}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSavePaste} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="mr-1.5 h-3.5 w-3.5" />
                )}
                Save &amp; Parse
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Version History Section
// ---------------------------------------------------------------------------

function VersionHistorySection({ sourceId }: { sourceId: string }) {
  const { data: versions, isLoading } = useQuery(openAPISourceVersionsQuery(sourceId));
  const [expandedVersion, setExpandedVersion] = useState<number | null>(null);

  if (isLoading) {
    return (
      <div>
        <SectionLabel>Version History</SectionLabel>
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading versions...
        </div>
      </div>
    );
  }

  if (!versions || versions.length === 0) return null;

  return (
    <div>
      <SectionLabel>Version History ({versions.length})</SectionLabel>
      <div className="rounded-md border divide-y">
        {versions.map((v) => (
          <VersionRow
            key={v.version_number}
            version={v}
            isExpanded={expandedVersion === v.version_number}
            onToggle={() =>
              setExpandedVersion(
                expandedVersion === v.version_number ? null : v.version_number
              )
            }
          />
        ))}
      </div>
    </div>
  );
}

function VersionRow({
  version,
  isExpanded,
  onToggle,
}: {
  version: OpenAPIToolSourceVersion;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div>
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-2.5 text-sm hover:bg-muted/50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <Badge variant="outline" className="font-mono text-xs">
            {version.display_version}
          </Badge>
          <span className="text-muted-foreground">
            {version.operation_count} operations
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          {formatDistanceToNow(new Date(version.created_at), {
            addSuffix: true,
          })}
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 pb-3 pt-1 border-t bg-muted/20">
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground mb-2">
            <span>Format: {version.spec_format?.toUpperCase() || "Unknown"}</span>
            {version.spec_url && <span>URL: {version.spec_url}</span>}
            <span>Version #{version.version_number}</span>
            {version.revision > 1 && <span>Revision {version.revision}</span>}
          </div>
          {version.discovered_operations && version.discovered_operations.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {version.discovered_operations.map((op) => {
                const methodColor = METHOD_COLORS[op.method.toLowerCase()] ?? "";
                return (
                  <span
                    key={op.operation_id}
                    className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-mono bg-muted/50"
                  >
                    <span className={`font-bold uppercase ${methodColor} rounded px-0.5`}>
                      {op.method}
                    </span>
                    {op.path}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Operation detail + discovered operations (unchanged)
// ---------------------------------------------------------------------------

function OperationDetailView({
  source,
  operationId,
  overviewHref,
}: {
  source: OpenAPIToolSource;
  operationId: string;
  overviewHref: string;
}) {
  const queryClient = useQueryClient();

  const operation = source.discovered_operations.find(
    (op) => op.operation_id === operationId
  );

  const config = source.operation_configs?.find(
    (c) => c.tool_name === operationId
  );

  const isEnabled = config?.is_enabled ?? true;
  const requiresConfirmation = config?.requires_confirmation ?? false;

  const configMutation = useMutation({
    ...updateOperationConfigsMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: openAPISourceKeys.detail(source.id) });
    },
    onError: () => {
      toast.error("Failed to update operation config");
    },
  });

  const updateConfig = (patch: { is_enabled?: boolean; requires_confirmation?: boolean }) => {
    configMutation.mutate({
      sourceId: source.id,
      updates: [{ tool_name: operationId, ...patch }],
    });
  };

  if (!operation) {
    return (
      <div className="space-y-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href={overviewHref}>{source.name}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="font-mono">
                {operationId}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Operation not found. It may have been removed during the last spec
            parse.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-4">
            <Link href={overviewHref}>Back to {source.name}</Link>
          </Button>
        </div>
      </div>
    );
  }

  const methodColor =
    METHOD_COLORS[operation.method.toLowerCase()] ?? "";

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={overviewHref}>{source.name}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <span className="text-muted-foreground">Operations</span>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="font-mono">
              {operation.operation_id}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div>
        <div className="flex items-center gap-3 mb-2">
          <span
            className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-mono font-bold uppercase ${methodColor}`}
          >
            {operation.method}
          </span>
          <span className="font-mono text-sm text-muted-foreground">
            {operation.path}
          </span>
        </div>
        <h2 className="text-xl font-semibold font-mono">
          {operation.operation_id}
        </h2>
        {operation.summary && (
          <p className="mt-1 text-sm text-muted-foreground">
            {operation.summary}
          </p>
        )}
        {operation.description && operation.description !== operation.summary && (
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            {operation.description}
          </p>
        )}
      </div>

      <div className="rounded-md border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">Enabled</p>
            <p className="text-xs text-muted-foreground">
              Disabled operations are hidden from agents
            </p>
          </div>
          <Switch
            checked={isEnabled}
            onCheckedChange={(checked) => updateConfig({ is_enabled: checked })}
            disabled={configMutation.isPending}
          />
        </div>

        <div className="border-t pt-3 flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">Require Confirmation</p>
            <p className="text-xs text-muted-foreground">
              User must approve before this operation executes
            </p>
          </div>
          <Switch
            checked={requiresConfirmation}
            onCheckedChange={(checked) => updateConfig({ requires_confirmation: checked })}
            disabled={configMutation.isPending || !isEnabled}
          />
        </div>
      </div>

      {operation.input_schema &&
        Object.keys(operation.input_schema).length > 0 && (
          <div>
            <SectionLabel>Input Schema</SectionLabel>
            <pre className="rounded-md border bg-muted/30 p-4 text-xs font-mono overflow-x-auto">
              {JSON.stringify(operation.input_schema, null, 2)}
            </pre>
          </div>
        )}

      {operation.parameters_meta &&
        Object.keys(operation.parameters_meta).length > 0 && (
          <div>
            <SectionLabel>Parameter Locations</SectionLabel>
            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">
                      Parameter
                    </th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">
                      Location
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(operation.parameters_meta).map(
                    ([param, location]) => (
                      <tr key={param} className="border-b last:border-b-0">
                        <td className="px-4 py-2 font-mono text-xs">
                          {param}
                        </td>
                        <td className="px-4 py-2">
                          <Badge variant="secondary" className="text-[10px]">
                            {location}
                          </Badge>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
    </div>
  );
}

function DiscoveredOperationsSection({
  operations,
  sourceId,
}: {
  operations: OpenAPIOperation[];
  sourceId: string;
}) {
  const grouped = useMemo(() => {
    const groups: Record<string, OpenAPIOperation[]> = {};
    for (const op of operations) {
      const tag = op.path.split("/").filter(Boolean)[0] ?? "other";
      (groups[tag] ??= []).push(op);
    }
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [operations]);

  return (
    <div>
      <SectionLabel>Discovered Operations ({operations.length})</SectionLabel>
      {operations.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No operations have been discovered yet. Try re-parsing the spec.
        </p>
      ) : (
        <div className="space-y-4">
          {grouped.map(([tag, ops]) => (
            <div key={tag}>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                /{tag}
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {ops.map((op) => {
                  const methodColor =
                    METHOD_COLORS[op.method.toLowerCase()] ?? "";
                  return (
                    <Link
                      key={op.operation_id}
                      href={`/tools/openapi/${sourceId}?op=${encodeURIComponent(op.operation_id)}`}
                      className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-mono transition-colors cursor-pointer bg-muted/50 text-foreground border-transparent hover:bg-muted hover:border-border"
                    >
                      <span
                        className={`text-[10px] font-bold uppercase ${methodColor} rounded px-1 py-0.5 border`}
                      >
                        {op.method}
                      </span>
                      {op.path}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
