"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Agent } from "@/types/agent";

interface ChannelSettingsTabProps {
  agent: Agent;
  onChange: (updates: Partial<Agent>) => void;
}

export function ChannelSettingsTab({ agent, onChange }: ChannelSettingsTabProps) {
  const cc = (agent.channel_config || {}) as Record<string, unknown>;

  const updateConfig = (key: string, value: unknown) => {
    onChange({ channel_config: { ...cc, [key]: value } });
  };

  return (
    <div className="space-y-6">
      {agent.channel === "web" && <WebSettings config={cc} updateConfig={updateConfig} />}
      {agent.channel === "slack" && <SlackSettings config={cc} updateConfig={updateConfig} />}
      {agent.channel === "email" && <EmailSettings config={cc} updateConfig={updateConfig} />}
      {agent.channel === "api" && <ApiSettings config={cc} updateConfig={updateConfig} />}
      {!["web", "slack", "email", "api"].includes(agent.channel) && (
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
}: {
  config: Record<string, unknown>;
  updateConfig: (key: string, value: unknown) => void;
}) {
  const channelIds = (config.slack_channel_ids as string[]) || [];
  const channelIdsStr = channelIds.join(", ");

  return (
    <>
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
