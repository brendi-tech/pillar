"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { v2Fetch, v2Patch } from "@/lib/admin/v2/api-client";
import { adminFetch } from "@/lib/admin/api-client";
import { useProduct } from "@/providers/ProductProvider";
import { Check, Copy, AlertTriangle, Plus, Loader2 } from "lucide-react";
import type { Agent } from "@/types/agent";

interface SlackInstallationStatus {
  id: string;
  team_name: string;
  is_active: boolean;
  is_byob: boolean;
  app_id: string;
}

interface ChannelSettingsTabProps {
  agent: Agent;
  productId: string;
  onChange: (updates: Partial<Agent>) => void;
}

export function ChannelSettingsTab({ agent, productId, onChange }: ChannelSettingsTabProps) {
  const cc = (agent.channel_config || {}) as Record<string, unknown>;

  const updateConfig = (key: string, value: unknown) => {
    onChange({ channel_config: { ...cc, [key]: value } });
  };

  return (
    <div className="space-y-6">
      {agent.channel === "web" && <WebSettings config={cc} updateConfig={updateConfig} />}
      {agent.channel === "slack" && <SlackSettings config={cc} updateConfig={updateConfig} productId={productId} />}
      {agent.channel === "email" && <EmailSettings config={cc} updateConfig={updateConfig} />}
      {agent.channel === "discord" && <DiscordSettings config={cc} updateConfig={updateConfig} productId={productId} />}
      {agent.channel === "api" && <ApiSettings config={cc} updateConfig={updateConfig} />}
      {agent.channel === "mcp" && <MCPSettings agent={agent} productId={productId} onChange={onChange} />}
      {!["web", "slack", "discord", "email", "api", "mcp"].includes(agent.channel) && (
        <p className="text-sm text-muted-foreground">
          Channel-specific settings for {agent.channel} are not yet available.
        </p>
      )}
    </div>
  );
}

function WebSettings({
  config,
  updateConfig,
}: {
  config: Record<string, unknown>;
  updateConfig: (key: string, value: unknown) => void;
}) {
  const panel = (config.panel || {}) as Record<string, unknown>;
  const floatingButton = (config.floatingButton || {}) as Record<string, unknown>;

  const updatePanel = (key: string, value: unknown) => {
    updateConfig("panel", { ...panel, [key]: value });
  };

  const updateButton = (key: string, value: unknown) => {
    updateConfig("floatingButton", { ...floatingButton, [key]: value });
  };

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="assistant-name">Assistant Name</Label>
        <Input
          id="assistant-name"
          value={(config.assistantName as string) || ""}
          onChange={(e) => updateConfig("assistantName", e.target.value)}
          placeholder="AI Assistant"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="welcome-message">Welcome Message</Label>
        <Textarea
          id="welcome-message"
          value={(config.welcomeMessage as string) || ""}
          onChange={(e) => updateConfig("welcomeMessage", e.target.value)}
          placeholder="Hi! How can I help?"
          className="min-h-[60px]"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="input-placeholder">Input Placeholder</Label>
        <Input
          id="input-placeholder"
          value={(config.inputPlaceholder as string) || ""}
          onChange={(e) => updateConfig("inputPlaceholder", e.target.value)}
          placeholder="Ask anything..."
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label>Open on Page Load</Label>
          <p className="text-xs text-muted-foreground">
            Automatically open the widget when the page loads
          </p>
        </div>
        <Switch
          checked={!!config.openOnLoad}
          onCheckedChange={(v) => updateConfig("openOnLoad", v)}
        />
      </div>

      <div className="space-y-2">
        <Label>Panel Position</Label>
        <Select
          value={(panel.position as string) || "right"}
          onValueChange={(v) => updatePanel("position", v)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="right">Right</SelectItem>
            <SelectItem value="left">Left</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="panel-width">Panel Width (px)</Label>
        <Input
          id="panel-width"
          type="number"
          value={(panel.width as number) || 380}
          onChange={(e) => updatePanel("width", parseInt(e.target.value, 10) || 380)}
          min={320}
          max={600}
        />
      </div>

      <div className="space-y-2">
        <Label>Button Position</Label>
        <Select
          value={(floatingButton.position as string) || "bottom-right"}
          onValueChange={(v) => updateButton("position", v)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="bottom-right">Bottom Right</SelectItem>
            <SelectItem value="bottom-left">Bottom Left</SelectItem>
            <SelectItem value="top-right">Top Right</SelectItem>
            <SelectItem value="top-left">Top Left</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="button-label">Button Label</Label>
        <Input
          id="button-label"
          value={(floatingButton.label as string) || ""}
          onChange={(e) => updateButton("label", e.target.value)}
          placeholder="Help"
        />
      </div>
    </>
  );
}

function SlackSettings({
  config,
  updateConfig,
  productId,
}: {
  config: Record<string, unknown>;
  updateConfig: (key: string, value: unknown) => void;
  productId: string;
}) {
  const queryClient = useQueryClient();
  const [appIdInput, setAppIdInput] = useState("");
  const channelIds = (config.slack_channel_ids as string[]) || [];
  const channelIdsStr = channelIds.join(", ");

  const { data: slackInstallation } = useQuery({
    queryKey: ["slack-installation", productId],
    queryFn: () =>
      v2Fetch<SlackInstallationStatus | null>(
        `/products/${productId}/integrations/slack/`
      ).catch(() => null),
    enabled: !!productId,
  });

  const updateAppIdMutation = useMutation({
    mutationFn: (appId: string) =>
      v2Patch<SlackInstallationStatus>(
        `/products/${productId}/integrations/slack/`,
        { app_id: appId }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["slack-installation", productId] });
      setAppIdInput("");
    },
  });

  return (
    <>
      {slackInstallation?.is_active ? (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2">
          <Badge
            variant="outline"
            className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          >
            Connected
          </Badge>
          <span className="text-sm text-muted-foreground">
            {slackInstallation.team_name}
          </span>
          {slackInstallation.is_byob && (
            <Badge variant="outline" className="text-xs">
              Custom Bot
            </Badge>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
          <p className="text-sm text-amber-600 dark:text-amber-400">
            No Slack bot connected. Create a new Slack agent to set one up.
          </p>
        </div>
      )}

      {slackInstallation?.is_active && slackInstallation.is_byob && !slackInstallation.app_id && (
        <Alert variant="default" className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/30">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800 dark:text-amber-200">
            App ID missing
          </AlertTitle>
          <AlertDescription className="text-amber-700 dark:text-amber-300 space-y-2">
            <p className="text-sm">
              Your Slack bot won&apos;t receive events without an App ID. Find it in your{" "}
              <strong>Slack app settings → Basic Information</strong> at the top of the page.
            </p>
            <div className="flex items-center gap-2">
              <Input
                placeholder="A07..."
                value={appIdInput}
                onChange={(e) => setAppIdInput(e.target.value)}
                className="max-w-[200px] text-sm font-mono"
              />
              <Button
                size="sm"
                onClick={() => updateAppIdMutation.mutate(appIdInput)}
                disabled={!appIdInput.trim() || updateAppIdMutation.isPending}
              >
                {updateAppIdMutation.isPending ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : null}
                Save
              </Button>
            </div>
            {updateAppIdMutation.isError && (
              <p className="text-xs text-destructive">
                Failed to update App ID. Please try again.
              </p>
            )}
          </AlertDescription>
        </Alert>
      )}
      <div className="space-y-2">
        <Label htmlFor="slack-channel-ids">Slack Channel IDs</Label>
        <Input
          id="slack-channel-ids"
          value={channelIdsStr}
          onChange={(e) => {
            const raw = e.target.value;
            const ids = raw
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
            updateConfig("slack_channel_ids", ids);
          }}
          placeholder="C0123ABC, C0456DEF"
        />
        <p className="text-xs text-muted-foreground">
          Comma-separated Slack channel IDs this agent responds in. Leave empty
          for this agent to be the default for all unassigned channels.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label>Thread Replies Only</Label>
          <p className="text-xs text-muted-foreground">
            Only respond in threads, not in channels
          </p>
        </div>
        <Switch
          checked={config.thread_replies_only !== false}
          onCheckedChange={(v) => updateConfig("thread_replies_only", v)}
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label>Thinking Reaction</Label>
          <p className="text-xs text-muted-foreground">
            Add a reaction emoji while processing
          </p>
        </div>
        <Switch
          checked={config.add_reaction_while_thinking !== false}
          onCheckedChange={(v) =>
            updateConfig("add_reaction_while_thinking", v)
          }
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="thinking-emoji">Thinking Emoji</Label>
        <Input
          id="thinking-emoji"
          value={(config.thinking_reaction as string) || "thinking_face"}
          onChange={(e) => updateConfig("thinking_reaction", e.target.value)}
          placeholder="thinking_face"
        />
      </div>
    </>
  );
}

function DiscordSettings({
  config,
  updateConfig,
  productId,
}: {
  config: Record<string, unknown>;
  updateConfig: (key: string, value: unknown) => void;
  productId: string;
}) {
  const { data: installation } = useQuery({
    queryKey: ["discord-installation", productId],
    queryFn: () =>
      v2Fetch<{ slash_command_name?: string } | null>(
        `/products/${productId}/integrations/discord/`
      ).catch(() => null),
    enabled: !!productId,
  });
  const slashName = installation?.slash_command_name || "pillar";

  const channelIds = (config.discord_channel_ids as string[]) || [];
  const channelIdsStr = channelIds.join(", ");

  return (
    <>
      <div className="rounded-lg border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">How interaction modes work</p>
        <p className="mt-1">
          <strong>Slash commands</strong> (<code>/{slashName} ask</code>) work immediately
          with no extra setup.
        </p>
        <p className="mt-1">
          <strong>DMs and @mentions</strong> require the Discord gateway process
          to be running. Contact your admin if these aren&apos;t working.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label>Respond to DMs</Label>
          <p className="text-xs text-muted-foreground">
            Respond when users DM the bot directly
          </p>
        </div>
        <Switch
          checked={config.respond_to_dms !== false}
          onCheckedChange={(v) => updateConfig("respond_to_dms", v)}
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label>Respond to Mentions</Label>
          <p className="text-xs text-muted-foreground">
            Respond when users @mention the bot in channels
          </p>
        </div>
        <Switch
          checked={config.respond_to_mentions !== false}
          onCheckedChange={(v) => updateConfig("respond_to_mentions", v)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="discord-channel-ids">Channel Allowlist</Label>
        <Input
          id="discord-channel-ids"
          value={channelIdsStr}
          onChange={(e) => {
            const raw = e.target.value;
            const ids = raw
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
            updateConfig("discord_channel_ids", ids);
          }}
          placeholder="Channel IDs, comma-separated (empty = all channels)"
        />
        <p className="text-xs text-muted-foreground">
          Limit which channels this agent responds in. Leave empty for all channels.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label>Thinking Reaction</Label>
          <p className="text-xs text-muted-foreground">
            Add a reaction emoji while processing
          </p>
        </div>
        <Switch
          checked={config.add_reaction_while_thinking !== false}
          onCheckedChange={(v) =>
            updateConfig("add_reaction_while_thinking", v)
          }
        />
      </div>
    </>
  );
}

function EmailSettings({
  config,
  updateConfig,
}: {
  config: Record<string, unknown>;
  updateConfig: (key: string, value: unknown) => void;
}) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="reply-from-name">Reply From Name</Label>
        <Input
          id="reply-from-name"
          value={(config.reply_from_name as string) || ""}
          onChange={(e) => updateConfig("reply_from_name", e.target.value)}
          placeholder="Acme Support"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="reply-from-email">Reply From Email</Label>
        <Input
          id="reply-from-email"
          type="email"
          value={(config.reply_from_email as string) || ""}
          onChange={(e) => updateConfig("reply_from_email", e.target.value)}
          placeholder="support@example.com"
        />
      </div>

      <div className="flex items-center justify-between">
        <Label>Include Signature</Label>
        <Switch
          checked={!!config.include_signature}
          onCheckedChange={(v) => updateConfig("include_signature", v)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="signature-html">Signature HTML</Label>
        <Textarea
          id="signature-html"
          value={(config.signature_html as string) || ""}
          onChange={(e) => updateConfig("signature_html", e.target.value)}
          placeholder="<p>— The Team</p>"
          className="min-h-[60px] font-mono text-xs"
        />
      </div>
    </>
  );
}

function ApiSettings({
  config,
  updateConfig,
}: {
  config: Record<string, unknown>;
  updateConfig: (key: string, value: unknown) => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label>Streaming Enabled</Label>
          <p className="text-xs text-muted-foreground">
            Enable streaming responses via SSE
          </p>
        </div>
        <Switch
          checked={config.streaming_enabled !== false}
          onCheckedChange={(v) => updateConfig("streaming_enabled", v)}
        />
      </div>

      <div className="space-y-2">
        <Label>Response Format</Label>
        <Select
          value={(config.response_format as string) || "markdown"}
          onValueChange={(v) => updateConfig("response_format", v)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="markdown">Markdown</SelectItem>
            <SelectItem value="html">HTML</SelectItem>
            <SelectItem value="plain">Plain Text</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </>
  );
}

interface MCPInfoResponse {
  mcp_url: string | null;
  subdomain: string | null;
  help_center_domain: string;
}

interface SyncSecretItem {
  id: string;
  name: string;
  last_four: string;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
}

function InlineCopyButton({ value, className }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={className}
      onClick={handleCopy}
      disabled={!value}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-600" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </Button>
  );
}

function MCPSettings({
  agent,
  productId,
  onChange,
}: {
  agent: Agent;
  productId: string;
  onChange: (updates: Partial<Agent>) => void;
}) {
  const { currentProduct } = useProduct();
  const queryClient = useQueryClient();
  const [generatedSecret, setGeneratedSecret] = useState<{ secret: string; name: string } | null>(null);
  const [newSecretName, setNewSecretName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);

  const { data: mcpInfo } = useQuery({
    queryKey: ["mcp-info", productId],
    queryFn: () => adminFetch<MCPInfoResponse>(`/configs/${productId}/mcp-info/`),
    enabled: !!productId,
  });

  const { data: secrets } = useQuery({
    queryKey: ["sync-secrets", productId],
    queryFn: () => adminFetch<SyncSecretItem[]>(`/configs/${productId}/secrets/`),
    enabled: !!productId,
  });

  const createSecretMutation = useMutation({
    mutationFn: async (name: string) => {
      return adminFetch<{ id: string; name: string; secret: string }>(
        `/configs/${productId}/secrets/`,
        { method: "POST", body: JSON.stringify({ name }) }
      );
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["sync-secrets", productId] });
      setGeneratedSecret({ secret: result.secret, name: result.name });
      setNewSecretName("");
      setNameError(null);
    },
    onError: (error: Error) => {
      setNameError(error.message || "Failed to create secret");
    },
  });

  const handleCreateSecret = () => {
    const name = newSecretName.toLowerCase().trim();
    if (!name) {
      setNameError("Name is required");
      return;
    }
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(name)) {
      setNameError("Use lowercase letters, numbers, and hyphens only");
      return;
    }
    setNameError(null);
    createSecretMutation.mutate(name);
  };

  const mcpUrl = mcpInfo?.mcp_url || "";
  const productName = currentProduct?.name || "my-product";
  const productSlug = (currentProduct?.subdomain || productName).toLowerCase().replace(/\s+/g, "-");

  const keyPlaceholder = generatedSecret?.secret || "<your-api-key>";

  const cursorConfig = JSON.stringify(
    {
      mcpServers: {
        [productSlug]: {
          url: mcpUrl || `https://<subdomain>.${mcpInfo?.help_center_domain || "help.pillar.io"}/mcp/`,
          headers: {
            Authorization: `Bearer ${keyPlaceholder}`,
          },
        },
      },
    },
    null,
    2
  );

  const claudeConfig = JSON.stringify(
    {
      mcpServers: {
        [productSlug]: {
          url: mcpUrl || `https://<subdomain>.${mcpInfo?.help_center_domain || "help.pillar.io"}/mcp/`,
          headers: {
            Authorization: `Bearer ${keyPlaceholder}`,
          },
        },
      },
    },
    null,
    2
  );

  const customDomainUrl = agent.mcp_domain ? `https://${agent.mcp_domain}/mcp/` : null;

  return (
    <div className="space-y-8">
      {/* Server URL */}
      <div className="space-y-3">
        <div>
          <Label className="text-sm font-medium">MCP Server URL</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Use this URL to connect MCP clients to your agent
          </p>
        </div>
        {mcpUrl ? (
          <div className="flex items-center gap-2">
            <Input
              value={mcpUrl}
              readOnly
              className="font-mono text-sm bg-muted"
            />
            <InlineCopyButton value={mcpUrl} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Set up a subdomain for your product to get an MCP server URL.
          </p>
        )}
        {customDomainUrl && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Custom Domain URL</Label>
            <div className="flex items-center gap-2">
              <Input
                value={customDomainUrl}
                readOnly
                className="font-mono text-sm bg-muted"
              />
              <InlineCopyButton value={customDomainUrl} />
            </div>
          </div>
        )}
      </div>

      {/* Custom Domain */}
      <div className="space-y-3">
        <div>
          <Label htmlFor="mcp-domain" className="text-sm font-medium">Custom Domain</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Optionally serve your MCP endpoint from your own domain
          </p>
        </div>
        <Input
          id="mcp-domain"
          value={agent.mcp_domain || ""}
          onChange={(e) => {
            const val = e.target.value.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
            onChange({ mcp_domain: val || null });
          }}
          placeholder="mcp.yourdomain.com"
          className="font-mono text-sm"
        />
        <div className="rounded-lg border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          Point a CNAME record for your domain to{" "}
          <code className="font-mono text-foreground">{mcpInfo?.help_center_domain || "help.pillar.io"}</code>.
          Changes may take up to 24 hours to propagate.
        </div>
      </div>

      {/* API Key */}
      <div className="space-y-3">
        <div>
          <Label className="text-sm font-medium">Authentication</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            MCP clients authenticate with a Bearer token. Create an API key below or use an existing one from the API Keys page.
          </p>
        </div>

        {generatedSecret && (
          <Alert variant="default" className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/30">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-800 dark:text-amber-200">
              Copy your &quot;{generatedSecret.name}&quot; key now
            </AlertTitle>
            <AlertDescription className="text-amber-700 dark:text-amber-300 space-y-2">
              <p>This key will only be shown once. Copy it and store it securely.</p>
              <div className="flex items-center gap-2 mt-2">
                <code className="flex-1 rounded bg-background border px-3 py-2 font-mono text-xs break-all">
                  {generatedSecret.secret}
                </code>
                <InlineCopyButton value={generatedSecret.secret} />
              </div>
            </AlertDescription>
          </Alert>
        )}

        {secrets && secrets.length > 0 && (
          <div className="rounded-lg border">
            <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 px-3 py-2 border-b bg-muted/30 text-xs font-medium text-muted-foreground">
              <span>Name</span>
              <span>Key</span>
              <span>Created</span>
            </div>
            {secrets.map((s) => (
              <div key={s.id} className="grid grid-cols-[1fr_auto_auto] gap-x-4 px-3 py-2 border-b last:border-b-0 text-sm items-center">
                <span className="font-mono text-xs">{s.name}</span>
                <span className="text-xs text-muted-foreground font-mono">
                  ••••{s.last_four}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(s.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <Input
            placeholder="e.g., mcp-production"
            value={newSecretName}
            onChange={(e) => {
              setNewSecretName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
              setNameError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreateSecret();
            }}
            className="font-mono text-sm"
          />
          <Button
            onClick={handleCreateSecret}
            variant="outline"
            size="sm"
            disabled={createSecretMutation.isPending || !newSecretName.trim()}
          >
            {createSecretMutation.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="mr-1.5 h-3.5 w-3.5" />
            )}
            Create Key
          </Button>
        </div>
        {nameError && (
          <p className="text-xs text-destructive">{nameError}</p>
        )}
      </div>

      {/* Setup Instructions */}
      <div className="space-y-3">
        <div>
          <Label className="text-sm font-medium">Setup Instructions</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Copy this configuration into your MCP client
          </p>
        </div>
        <Tabs defaultValue="cursor">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="cursor">Cursor</TabsTrigger>
            <TabsTrigger value="claude">Claude Desktop</TabsTrigger>
          </TabsList>
          <TabsContent value="cursor" className="mt-3">
            <div className="relative">
              <pre className="rounded-lg bg-zinc-950 p-4 text-xs text-zinc-100 overflow-x-auto">
                <code>{cursorConfig}</code>
              </pre>
              <InlineCopyButton value={cursorConfig} className="absolute top-2 right-2 text-zinc-400 hover:text-zinc-100" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Add to <code className="font-mono text-foreground">.cursor/mcp.json</code> in your project root, or to your global Cursor settings.
            </p>
          </TabsContent>
          <TabsContent value="claude" className="mt-3">
            <div className="relative">
              <pre className="rounded-lg bg-zinc-950 p-4 text-xs text-zinc-100 overflow-x-auto">
                <code>{claudeConfig}</code>
              </pre>
              <InlineCopyButton value={claudeConfig} className="absolute top-2 right-2 text-zinc-400 hover:text-zinc-100" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Add to your <code className="font-mono text-foreground">claude_desktop_config.json</code> file.
            </p>
          </TabsContent>
        </Tabs>
      </div>

      {/* OAuth Configuration */}
      <OAuthProviderSection productId={productId} />
    </div>
  );
}

interface OAuthProviderData {
  configured: boolean;
  id?: string;
  provider_type?: string;
  issuer_url?: string;
  authorization_endpoint?: string;
  token_endpoint?: string;
  userinfo_endpoint?: string;
  client_id?: string;
  has_client_secret?: boolean;
  scopes?: string;
  user_id_claim?: string;
  email_claim?: string;
  name_claim?: string;
  is_active?: boolean;
}

interface OIDCDiscoveryResult {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  scopes_supported: string[];
}

function OAuthProviderSection({ productId }: { productId: string }) {
  const queryClient = useQueryClient();
  const [issuerInput, setIssuerInput] = useState("");
  const [formData, setFormData] = useState<Record<string, string>>({});

  const { data: provider, isPending } = useQuery({
    queryKey: ["oauth-provider", productId],
    queryFn: () =>
      adminFetch<OAuthProviderData>(`/products/${productId}/oauth-provider/`),
    enabled: !!productId,
  });

  const discoverMutation = useMutation({
    mutationFn: async (issuerUrl: string) =>
      adminFetch<OIDCDiscoveryResult>(
        `/products/${productId}/oauth-provider/discover/`,
        { method: "POST", body: JSON.stringify({ issuer_url: issuerUrl }) }
      ),
    onSuccess: (result) => {
      setFormData((prev) => ({
        ...prev,
        issuer_url: issuerInput,
        authorization_endpoint: result.authorization_endpoint,
        token_endpoint: result.token_endpoint,
        userinfo_endpoint: result.userinfo_endpoint || "",
      }));
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) =>
      adminFetch<OAuthProviderData>(
        `/products/${productId}/oauth-provider/`,
        { method: "PUT", body: JSON.stringify(data) }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["oauth-provider", productId],
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () =>
      adminFetch<void>(`/products/${productId}/oauth-provider/`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      setFormData({});
      queryClient.invalidateQueries({
        queryKey: ["oauth-provider", productId],
      });
    },
  });

  const getField = (key: string, fallback = "") =>
    formData[key] ?? (provider as unknown as Record<string, unknown>)?.[key] ?? fallback;

  const updateField = (key: string, value: string) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  const handleSave = () => {
    const payload: Record<string, unknown> = {
      provider_type: getField("provider_type", "oidc"),
      issuer_url: getField("issuer_url"),
      authorization_endpoint: getField("authorization_endpoint"),
      token_endpoint: getField("token_endpoint"),
      userinfo_endpoint: getField("userinfo_endpoint"),
      client_id: getField("client_id"),
      scopes: getField("scopes", "openid email profile"),
      user_id_claim: getField("user_id_claim", "sub"),
      email_claim: getField("email_claim", "email"),
      name_claim: getField("name_claim", "name"),
      is_active: String(getField("is_active")) === "true",
    };
    const secret = formData["client_secret"];
    if (secret) payload.client_secret = secret;
    saveMutation.mutate(payload);
  };

  if (isPending) {
    return null;
  }

  const isConfigured = provider?.configured;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">OAuth Configuration</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Require MCP clients to authenticate via your identity provider
          </p>
        </div>
        {isConfigured && (
          <Badge
            variant={provider?.is_active ? "default" : "secondary"}
            className="text-xs"
          >
            {provider?.is_active ? "Active" : "Inactive"}
          </Badge>
        )}
      </div>

      {!isConfigured && Object.keys(formData).length === 0 ? (
        <div className="rounded-lg border border-dashed p-4 text-center">
          <p className="text-sm text-muted-foreground mb-3">
            No identity provider configured. Set one up to require OAuth
            authentication for MCP clients.
          </p>
          <div className="flex items-center gap-2 max-w-md mx-auto">
            <Input
              placeholder="https://accounts.google.com"
              value={issuerInput}
              onChange={(e) => setIssuerInput(e.target.value)}
              className="text-sm"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (issuerInput.trim()) {
                  discoverMutation.mutate(issuerInput.trim());
                } else {
                  setFormData({ provider_type: "oidc" });
                }
              }}
              disabled={discoverMutation.isPending}
            >
              {discoverMutation.isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : null}
              {issuerInput.trim() ? "Discover" : "Manual Setup"}
            </Button>
          </div>
          {discoverMutation.isError && (
            <p className="text-xs text-destructive mt-2">
              {discoverMutation.error instanceof Error
                ? discoverMutation.error.message
                : "Discovery failed"}
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-lg border p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Authorization Endpoint</Label>
              <Input
                value={getField("authorization_endpoint") as string}
                onChange={(e) =>
                  updateField("authorization_endpoint", e.target.value)
                }
                placeholder="https://..."
                className="text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Token Endpoint</Label>
              <Input
                value={getField("token_endpoint") as string}
                onChange={(e) =>
                  updateField("token_endpoint", e.target.value)
                }
                placeholder="https://..."
                className="text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Userinfo Endpoint (optional)</Label>
            <Input
              value={getField("userinfo_endpoint") as string}
              onChange={(e) =>
                updateField("userinfo_endpoint", e.target.value)
              }
              placeholder="https://..."
              className="text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Client ID</Label>
              <Input
                value={getField("client_id") as string}
                onChange={(e) => updateField("client_id", e.target.value)}
                placeholder="your-oauth-client-id"
                className="text-xs font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">
                Client Secret{" "}
                {provider?.has_client_secret && !formData["client_secret"] && (
                  <span className="text-muted-foreground">(saved)</span>
                )}
              </Label>
              <Input
                type="password"
                value={formData["client_secret"] ?? ""}
                onChange={(e) =>
                  updateField("client_secret", e.target.value)
                }
                placeholder={
                  provider?.has_client_secret
                    ? "Leave blank to keep current"
                    : "your-client-secret"
                }
                className="text-xs font-mono"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Scopes</Label>
            <Input
              value={getField("scopes", "openid email profile") as string}
              onChange={(e) => updateField("scopes", e.target.value)}
              placeholder="openid email profile"
              className="text-xs font-mono"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">User ID Claim</Label>
              <Input
                value={getField("user_id_claim", "sub") as string}
                onChange={(e) => updateField("user_id_claim", e.target.value)}
                className="text-xs font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email Claim</Label>
              <Input
                value={getField("email_claim", "email") as string}
                onChange={(e) => updateField("email_claim", e.target.value)}
                className="text-xs font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Name Claim</Label>
              <Input
                value={getField("name_claim", "name") as string}
                onChange={(e) => updateField("name_claim", e.target.value)}
                className="text-xs font-mono"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <Switch
                checked={
                  String(getField("is_active")) === "true"
                }
                onCheckedChange={(v) =>
                  updateField("is_active", String(v))
                }
                className="h-4 w-7 [&>span]:h-3 [&>span]:w-3 [&>span]:data-[state=checked]:translate-x-3"
              />
              <Label className="text-xs">
                Require OAuth for MCP clients
              </Label>
            </div>
            <div className="flex items-center gap-2">
              {isConfigured && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive text-xs"
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                >
                  Remove
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saveMutation.isPending}
                className="text-xs"
              >
                {saveMutation.isPending && (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                )}
                {isConfigured ? "Update" : "Save"}
              </Button>
            </div>
          </div>

          {saveMutation.isError && (
            <p className="text-xs text-destructive">
              {saveMutation.error instanceof Error
                ? saveMutation.error.message
                : "Failed to save"}
            </p>
          )}
          {saveMutation.isSuccess && (
            <p className="text-xs text-green-600">
              OAuth provider saved successfully.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
