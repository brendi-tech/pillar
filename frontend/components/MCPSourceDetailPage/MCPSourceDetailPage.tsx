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
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { mcpSourcesAPI } from "@/lib/admin/mcp-sources-api";
import {
  mcpSourceDetailQuery,
  mcpSourceKeys,
  mcpResourceContentQuery,
  deleteMcpSourceMutation,
  refreshMcpSourceMutation,
} from "@/queries/mcpSource.queries";
import type {
  MCPDiscoveredPrompt,
  MCPDiscoveredResource,
  MCPDiscoveredTool,
  MCPToolSource,
} from "@/types/mcpSource";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { AlertCircle, Download, ExternalLink, Loader2, RefreshCw, Trash2, Unplug } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { toast } from "sonner";

interface MCPSourceDetailPageProps {
  sourceId: string;
}

const AUTH_TYPE_LABELS: Record<string, string> = {
  none: "No Auth",
  bearer: "Bearer Token",
  header: "Custom Header",
  oauth: "OAuth",
};

const STATUS_VARIANTS: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  success: "default",
  pending: "secondary",
  error: "destructive",
};

export function MCPSourceDetailPage({ sourceId }: MCPSourceDetailPageProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  const {
    data: source,
    isLoading,
    error,
    refetch,
  } = useQuery(mcpSourceDetailQuery(sourceId));

  const activeItem = useMemo(() => {
    const toolName = searchParams.get("tool");
    if (toolName) return { type: "tool" as const, name: toolName };
    const resourceName = searchParams.get("resource");
    if (resourceName) return { type: "resource" as const, name: resourceName };
    const promptName = searchParams.get("prompt");
    if (promptName) return { type: "prompt" as const, name: promptName };
    return null;
  }, [searchParams]);

  const needsOAuth =
    source?.auth_type === "oauth" &&
    source?.oauth_status !== "authorized" &&
    source?.oauth_status !== "none";

  const handleAuthorize = async () => {
    if (!source) return;
    try {
      const url = await mcpSourcesAPI.getOAuthAuthorizeUrl(source.id);
      window.open(url, "_blank");
    } catch {
      toast.error("Failed to start OAuth authorization");
    }
  };

  const refreshMutation = useMutation({
    ...refreshMcpSourceMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mcpSourceKeys.all });
      if (needsOAuth) {
        toast.info("OAuth discovery updated — authorize to discover tools");
      } else {
        toast.success("Tool discovery refreshed");
      }
    },
    onError: () => {
      toast.error("Failed to refresh tools");
    },
  });

  const deleteMutation = useMutation({
    ...deleteMcpSourceMutation(),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: mcpSourceKeys.detail(sourceId) });
      queryClient.invalidateQueries({ queryKey: mcpSourceKeys.lists() });
      toast.success("MCP source deleted");
      router.push("/tools");
    },
    onError: () => {
      toast.error("Failed to delete MCP source");
    },
  });

  const metadataItems: MetadataItem[] = source
    ? [
        {
          label: "Server URL",
          value: source.url,
          colSpan: 2,
          allowWrap: true,
        },
        {
          label: "Authentication",
          value: AUTH_TYPE_LABELS[source.auth_type] ?? source.auth_type,
        },
        {
          label: "Tools Discovered",
          value: String(source.tool_count),
        },
        {
          label: "Resources Discovered",
          value: String(source.resource_count),
        },
        {
          label: "Last Discovery",
          value: source.last_discovery_at
            ? formatDistanceToNow(new Date(source.last_discovery_at), {
                addSuffix: true,
              })
            : "Never",
        },
        {
          label: "Last Ping",
          value: source.last_ping_at
            ? formatDistanceToNow(new Date(source.last_ping_at), {
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

  const overviewHref = `/tools/mcp/${sourceId}`;

  return (
    <DetailPageShell
      isLoading={isLoading}
      error={error ?? null}
      isEmpty={!source && !isLoading && !error}
      emptyTitle="Source not found"
      emptyDescription="Select an MCP source from the sidebar to view its details."
      onRetry={refetch}
    >
      {source && (
        <>
          {activeItem ? (
            <ItemDetailView
              source={source}
              activeItem={activeItem}
              overviewHref={overviewHref}
            />
          ) : (
            <SourceOverview
              source={source}
              sourceId={sourceId}
              metadataItems={metadataItems}
              needsOAuth={needsOAuth}
              handleAuthorize={handleAuthorize}
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
  needsOAuth,
  handleAuthorize,
  refreshMutation,
  deleteMutation,
}: {
  source: MCPToolSource;
  sourceId: string;
  metadataItems: MetadataItem[];
  needsOAuth: boolean;
  handleAuthorize: () => void;
  refreshMutation: { mutate: (id: string) => void; isPending: boolean };
  deleteMutation: { mutate: (id: string) => void; isPending: boolean };
}) {
  return (
    <>
      <DetailHeader
        title={source.name}
        subtitle={source.slug}
        subtitleMono
        icon={<Unplug className="h-5 w-5" />}
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
            {source.last_ping_success ? (
              <Badge
                variant="outline"
                className="text-emerald-700 border-emerald-200 dark:text-emerald-400 dark:border-emerald-800"
              >
                Connected
              </Badge>
            ) : (
              source.last_ping_at && (
                <Badge
                  variant="outline"
                  className="text-red-700 border-red-200 dark:text-red-400 dark:border-red-800"
                >
                  Disconnected
                </Badge>
              )
            )}
          </>
        }
        actions={
          <div className="flex items-center gap-2">
            {needsOAuth ? (
              <Button size="sm" onClick={handleAuthorize}>
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                Authorize
              </Button>
            ) : (
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
                Refresh
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
                  <AlertDialogTitle>Delete MCP Source</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently remove &ldquo;{source.name}&rdquo;
                    and detach it from all agents. This action cannot be
                    undone.
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

      {needsOAuth && (
        <div className="flex items-center justify-between rounded-md border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-3">
          <p className="text-sm text-amber-700 dark:text-amber-300">
            This source requires OAuth authorization before tools can be
            discovered.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleAuthorize}
            className="shrink-0 ml-3 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950"
          >
            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
            Authorize
          </Button>
        </div>
      )}

      {source.discovery_status === "error" && source.discovery_error && (
        <div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400 rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-3">
          <span className="font-medium shrink-0">Discovery error:</span>
          <span>{source.discovery_error}</span>
        </div>
      )}

      {metadataItems.length > 0 && <MetadataStrip items={metadataItems} />}

      <DiscoveredToolsSection tools={source.discovered_tools} sourceId={source.id} />
      <DiscoveredResourcesSection resources={source.discovered_resources} sourceId={source.id} />
      <DiscoveredPromptsSection prompts={source.discovered_prompts ?? []} sourceId={source.id} />
    </>
  );
}

function ItemDetailView({
  source,
  activeItem,
  overviewHref,
}: {
  source: MCPToolSource;
  activeItem: { type: "tool" | "resource" | "prompt"; name: string };
  overviewHref: string;
}) {
  const categoryLabel =
    activeItem.type === "tool"
      ? "Tools"
      : activeItem.type === "resource"
        ? "Resources"
        : "Prompts";

  if (activeItem.type === "tool") {
    const tool = source.discovered_tools.find(
      (t) => t.name === activeItem.name
    );
    if (!tool) {
      return <ItemNotFound overviewHref={overviewHref} sourceName={source.name} category={categoryLabel} itemName={activeItem.name} />;
    }
    return (
      <div className="space-y-6">
        <ItemBreadcrumb
          sourceName={source.name}
          overviewHref={overviewHref}
          category={categoryLabel}
          itemName={tool.name}
        />
        <ToolDetailContent tool={tool} source={source} />
      </div>
    );
  }

  if (activeItem.type === "resource") {
    const resource = source.discovered_resources.find(
      (r) => r.name === activeItem.name
    );
    if (!resource) {
      return <ItemNotFound overviewHref={overviewHref} sourceName={source.name} category={categoryLabel} itemName={activeItem.name} />;
    }
    return (
      <div className="space-y-6">
        <ItemBreadcrumb
          sourceName={source.name}
          overviewHref={overviewHref}
          category={categoryLabel}
          itemName={resource.name}
        />
        <ResourceDetailContent resource={resource} sourceId={source.id} />
      </div>
    );
  }

  const prompt = (source.discovered_prompts ?? []).find(
    (p) => p.name === activeItem.name
  );
  if (!prompt) {
    return <ItemNotFound overviewHref={overviewHref} sourceName={source.name} category={categoryLabel} itemName={activeItem.name} />;
  }
  return (
    <div className="space-y-6">
      <ItemBreadcrumb
        sourceName={source.name}
        overviewHref={overviewHref}
        category={categoryLabel}
        itemName={prompt.name}
      />
      <PromptDetailContent prompt={prompt} />
    </div>
  );
}

function ItemBreadcrumb({
  sourceName,
  overviewHref,
  category,
  itemName,
}: {
  sourceName: string;
  overviewHref: string;
  category: string;
  itemName: string;
}) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href={overviewHref}>{sourceName}</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <span className="text-muted-foreground">{category}</span>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage className="font-mono">{itemName}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

function ItemNotFound({
  overviewHref,
  sourceName,
  category,
  itemName,
}: {
  overviewHref: string;
  sourceName: string;
  category: string;
  itemName: string;
}) {
  return (
    <div className="space-y-6">
      <ItemBreadcrumb
        sourceName={sourceName}
        overviewHref={overviewHref}
        category={category}
        itemName={itemName}
      />
      <div className="rounded-md border border-dashed p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Item not found. It may have been removed during the last discovery.
        </p>
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link href={overviewHref}>Back to {sourceName}</Link>
        </Button>
      </div>
    </div>
  );
}

function ToolDetailContent({ tool, source }: { tool: MCPDiscoveredTool; source: MCPToolSource }) {
  const queryClient = useQueryClient();
  const config = source.tool_configs?.find((c) => c.tool_name === tool.name);
  const isEnabled = config?.is_enabled ?? true;
  const requiresConfirmation = config?.requires_confirmation ?? false;

  const configMutation = useMutation({
    mutationFn: (updates: Array<{ tool_name: string; is_enabled?: boolean; requires_confirmation?: boolean }>) =>
      mcpSourcesAPI.updateToolConfigs(source.id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mcpSourceKeys.detail(source.id) });
    },
    onError: () => {
      toast.error("Failed to update tool config");
    },
  });

  const updateConfig = (patch: { is_enabled?: boolean; requires_confirmation?: boolean }) => {
    configMutation.mutate([{ tool_name: tool.name, ...patch }]);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold font-mono">{tool.name}</h2>
        {tool.description && (
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            {tool.description}
          </p>
        )}
      </div>

      <div className="rounded-md border bg-muted/30 p-4 space-y-4">
        <SectionLabel>Configuration</SectionLabel>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Enabled</p>
            <p className="text-xs text-muted-foreground">Allow agents to use this tool</p>
          </div>
          <Switch
            checked={isEnabled}
            onCheckedChange={(checked) => updateConfig({ is_enabled: checked })}
            disabled={configMutation.isPending}
          />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Requires Confirmation</p>
            <p className="text-xs text-muted-foreground">Ask user before executing</p>
          </div>
          <Switch
            checked={requiresConfirmation}
            onCheckedChange={(checked) => updateConfig({ requires_confirmation: checked })}
            disabled={configMutation.isPending || !isEnabled}
          />
        </div>
      </div>

      {tool.inputSchema && Object.keys(tool.inputSchema).length > 0 && (
        <div>
          <SectionLabel>Input Schema</SectionLabel>
          <pre className="rounded-md border bg-muted/30 p-4 text-xs font-mono overflow-x-auto">
            {JSON.stringify(tool.inputSchema, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function ResourceDetailContent({
  resource,
  sourceId,
}: {
  resource: MCPDiscoveredResource;
  sourceId: string;
}) {
  const { data, isPending, isError, error } = useQuery(
    mcpResourceContentQuery(sourceId, resource.uri)
  );

  const contentText = data?.success
    ? data.contents
        ?.map((c) => c.text ?? "")
        .filter(Boolean)
        .join("\n")
    : null;

  const contentMime =
    data?.contents?.[0]?.mimeType ?? resource.mimeType ?? "text/plain";
  const isJson = contentMime.includes("json");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold font-mono">{resource.name}</h2>
        {resource.description && (
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            {resource.description}
          </p>
        )}
      </div>

      <div className="rounded-md border bg-muted/30 p-4 space-y-3">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            URI
          </span>
          <span className="text-sm font-mono break-all">{resource.uri}</span>
        </div>
        {resource.mimeType && (
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Type
            </span>
            <span className="text-sm font-mono">{resource.mimeType}</span>
          </div>
        )}
      </div>

      <div>
        <SectionLabel>Content</SectionLabel>
        {isPending ? (
          <div className="rounded-md border bg-muted/30 p-6 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading resource content...
          </div>
        ) : isError || (data && !data.success) ? (
          <div className="rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-4 flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              {data?.error ??
                (error instanceof Error ? error.message : "Failed to read resource")}
            </span>
          </div>
        ) : contentText ? (
          <ResourceContentBlock text={contentText} isJson={isJson} />
        ) : (
          <p className="text-sm text-muted-foreground italic">
            No text content returned.
          </p>
        )}
      </div>
    </div>
  );
}

function formatJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

const ARCHIVE_EXTENSIONS = [".zip", ".tar", ".tar.gz", ".tgz", ".gz", ".bz2", ".7z", ".rar"];

function isUrl(text: string): boolean {
  const trimmed = text.trim();
  return /^https?:\/\/\S+$/.test(trimmed) && !trimmed.includes("\n");
}

function isArchiveUrl(url: string): boolean {
  const path = url.split("?")[0].toLowerCase();
  return ARCHIVE_EXTENSIONS.some((ext) => path.endsWith(ext));
}

function ResourceContentBlock({
  text,
  isJson,
}: {
  text: string;
  isJson: boolean;
}) {
  if (isUrl(text)) {
    const url = text.trim();
    const filename = decodeURIComponent(url.split("/").pop()?.split("?")[0] ?? url);
    const isArchive = isArchiveUrl(url);

    return (
      <div className="rounded-md border bg-muted/30 p-4 flex items-center gap-3">
        {isArchive ? (
          <Download className="h-5 w-5 text-muted-foreground shrink-0" />
        ) : (
          <ExternalLink className="h-5 w-5 text-muted-foreground shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium underline underline-offset-4 decoration-muted-foreground/40 hover:decoration-foreground transition-colors break-all"
          >
            {filename}
          </a>
          {isArchive && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Archive file — click to download
            </p>
          )}
        </div>
        <Button asChild variant="outline" size="sm" className="shrink-0">
          <a href={url} target="_blank" rel="noopener noreferrer">
            {isArchive ? "Download" : "Open"}
          </a>
        </Button>
      </div>
    );
  }

  return (
    <pre className="rounded-md border bg-muted/30 p-4 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-words max-h-[600px] overflow-y-auto">
      {isJson ? formatJson(text) : text}
    </pre>
  );
}

function PromptDetailContent({ prompt }: { prompt: MCPDiscoveredPrompt }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold font-mono">{prompt.name}</h2>
        {prompt.description && (
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            {prompt.description}
          </p>
        )}
      </div>

      {prompt.arguments && prompt.arguments.length > 0 && (
        <div>
          <SectionLabel>Arguments</SectionLabel>
          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">
                    Name
                  </th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">
                    Description
                  </th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">
                    Required
                  </th>
                </tr>
              </thead>
              <tbody>
                {prompt.arguments.map((arg) => (
                  <tr key={arg.name} className="border-b last:border-b-0">
                    <td className="px-4 py-2 font-mono text-xs">
                      {arg.name}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {arg.description || "\u2014"}
                    </td>
                    <td className="px-4 py-2">
                      <Badge
                        variant={arg.required ? "default" : "secondary"}
                        className="text-[10px]"
                      >
                        {arg.required ? "required" : "optional"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function DiscoveredToolsSection({
  tools,
  sourceId,
}: {
  tools: MCPDiscoveredTool[];
  sourceId: string;
}) {
  return (
    <div>
      <SectionLabel>Discovered Tools ({tools.length})</SectionLabel>
      {tools.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No tools have been discovered yet. Try refreshing the source.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {tools.map((tool) => (
            <Link
              key={tool.name}
              href={`/tools/mcp/${sourceId}?tool=${encodeURIComponent(tool.name)}`}
              className="inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-mono transition-colors cursor-pointer bg-muted/50 text-foreground border-transparent hover:bg-muted hover:border-border"
            >
              {tool.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function DiscoveredResourcesSection({
  resources,
  sourceId,
}: {
  resources: MCPDiscoveredResource[];
  sourceId: string;
}) {
  if (!resources.length) return null;

  return (
    <div>
      <SectionLabel>Discovered Resources ({resources.length})</SectionLabel>
      <div className="flex flex-wrap gap-1.5">
        {resources.map((resource) => (
          <Link
            key={resource.uri}
            href={`/tools/mcp/${sourceId}?resource=${encodeURIComponent(resource.name)}`}
            className="inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-mono transition-colors cursor-pointer bg-muted/50 text-foreground border-transparent hover:bg-muted hover:border-border"
          >
            {resource.name}
          </Link>
        ))}
      </div>
    </div>
  );
}

function DiscoveredPromptsSection({
  prompts,
  sourceId,
}: {
  prompts: MCPDiscoveredPrompt[];
  sourceId: string;
}) {
  if (!prompts.length) return null;

  return (
    <div>
      <SectionLabel>Discovered Prompts ({prompts.length})</SectionLabel>
      <div className="flex flex-wrap gap-1.5">
        {prompts.map((prompt) => (
          <Link
            key={prompt.name}
            href={`/tools/mcp/${sourceId}?prompt=${encodeURIComponent(prompt.name)}`}
            className="inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-mono transition-colors cursor-pointer bg-muted/50 text-foreground border-transparent hover:bg-muted hover:border-border"
          >
            {prompt.name}
          </Link>
        ))}
      </div>
    </div>
  );
}
