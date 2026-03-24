"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  agentListQuery,
  agentKeys,
  createAgentMutation,
} from "@/queries/agent.queries";
import { AgentCard } from "./AgentCard";
import { ProductDefaultsSection } from "./ProductDefaultsSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { CHANNEL_LABELS, type AgentChannel } from "@/types/agent";
import { v2Fetch, v2Patch, v2Post } from "@/lib/admin/v2/api-client";
import {
  Plus,
  Globe,
  MessageSquare,
  Mail,
  Terminal,
  Hash,
  Server,
  Bot,
  ExternalLink,
  ArrowLeft,
  Check,
  ClipboardCopy,
  Loader2,
  CheckCircle2,
  XCircle,
  Info,
} from "lucide-react";
import { toast } from "sonner";

const CHANNEL_ICONS: Record<string, React.ElementType> = {
  web: Globe,
  slack: MessageSquare,
  discord: Hash,
  email: Mail,
  api: Terminal,
  mcp: Server,
};

type SlackStep = "name" | "bot-type" | "byob";
type DiscordStep = "setup" | "interactions" | "checklist";

interface BYOBSetupResponse {
  installation: Record<string, unknown>;
  webhook_urls: {
    events: string;
    commands: string;
    interactions: string;
  };
  created: boolean;
}

interface DiscordBYOBSetupResponse {
  status?: 'needs_guild' | 'select_guild';
  installation?: { guild_name: string; application_id?: string };
  interactions_url?: string;
  invite_url?: string;
  guilds?: Array<{ id: string; name: string }>;
  application_id?: string;
  bot_user_id?: string;
  slash_commands_registered?: boolean;
  message_content_intent?: 'enabled' | 'auto_enabled' | 'not_enabled';
}

interface VerifyResult {
  bot_token_valid: boolean;
  message_content_intent: boolean;
  guild_accessible: boolean;
  slash_commands_registered: boolean;
  all_ok: boolean;
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button variant="outline" size="sm" onClick={handleCopy}>
      {copied ? (
        <Check className="mr-1.5 h-3.5 w-3.5" />
      ) : (
        <ClipboardCopy className="mr-1.5 h-3.5 w-3.5" />
      )}
      {copied ? "Copied" : (label ?? "Copy")}
    </Button>
  );
}

function StepNumber({ n }: { n: number }) {
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
      {n}
    </span>
  );
}

interface AgentsPageProps {
  productId: string;
  productName: string;
  agentGuidance: string;
  defaultLanguage: string;
  onProductRefetch: () => void;
}

export function AgentsPage({
  productId,
  productName,
  agentGuidance,
  defaultLanguage,
  onProductRefetch,
}: AgentsPageProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showAddDialog, setShowAddDialog] = useState(false);

  // Slack wizard state
  const [slackStep, setSlackStep] = useState<SlackStep | null>(null);
  const [slackAgentName, setSlackAgentName] = useState("");
  const [botToken, setBotToken] = useState("");
  const [signingSecret, setSigningSecret] = useState("");
  const [slackAppId, setSlackAppId] = useState("");

  // Discord wizard state
  const [discordStep, setDiscordStep] = useState<DiscordStep | null>(null);
  const [discordAgentName, setDiscordAgentName] = useState("");
  const [discordBotToken, setDiscordBotToken] = useState("");
  const [discordGuildName, setDiscordGuildName] = useState("");
  const [discordInteractionsUrl, setDiscordInteractionsUrl] = useState("");
  const [discordInviteUrl, setDiscordInviteUrl] = useState("");
  const [discordGuilds, setDiscordGuilds] = useState<Array<{ id: string; name: string }>>([]);
  const [discordSelectedGuildId, setDiscordSelectedGuildId] = useState("");
  const [discordSlashRegistered, setDiscordSlashRegistered] = useState(false);
  const [discordInstallationCreated, setDiscordInstallationCreated] = useState(false);
  const [isRechecking, setIsRechecking] = useState(false);
  const [discordApplicationId, setDiscordApplicationId] = useState("");
  const [discordMessageContentOk, setDiscordMessageContentOk] = useState<boolean | null>(null);
  const [discordSlashName, setDiscordSlashName] = useState(
    productName.toLowerCase().replace(/[^a-z0-9_-]/g, "") || "pillar"
  );

  const {
    data: agents,
    isPending: isAgentsPending,
    isError: isAgentsError,
  } = useQuery(agentListQuery(productId));

  const createAgent = useMutation({
    ...createAgentMutation(),
    onSuccess: (newAgent) => {
      queryClient.invalidateQueries({ queryKey: agentKeys.lists() });
      if (slackStep || discordStep) return;
      setShowAddDialog(false);
      toast.success(`${CHANNEL_LABELS[newAgent.channel]} agent created`);
      router.push(`/agents/${newAgent.id}`);
    },
    onError: () => {
      toast.error("Failed to create agent");
    },
  });

  const { data: manifestData, isPending: isManifestPending } = useQuery({
    queryKey: ["slack-manifest", productId],
    queryFn: () =>
      v2Fetch<{ manifest: Record<string, unknown> }>(
        `/products/${productId}/integrations/slack/manifest/`
      ),
    enabled: slackStep === "byob" && !!productId,
  });

  const manifestJson = manifestData?.manifest
    ? JSON.stringify(manifestData.manifest, null, 2)
    : "";

  const byobMutation = useMutation({
    mutationFn: (agentId: string) =>
      v2Post<BYOBSetupResponse>(
        `/products/${productId}/integrations/slack/byob/`,
        {
          bot_token: botToken,
          signing_secret: signingSecret,
          app_id: slackAppId,
          agent_id: agentId,
        }
      ),
    onSuccess: () => {
      toast.success("Slack agent created and connected");
    },
    onError: () => {
      toast.error("Failed to connect. Check your bot token and try again.");
    },
  });

  const oauthInstallMutation = useMutation({
    mutationFn: (agentId: string) =>
      v2Post<{ authorize_url: string }>(
        `/products/${productId}/integrations/slack/install/`,
        { agent_id: agentId }
      ),
    onSuccess: (data) => {
      window.location.href = data.authorize_url;
    },
    onError: () => {
      toast.error("Failed to start Slack OAuth flow");
    },
  });

  const discordByobMutation = useMutation({
    mutationFn: (guildId?: string) =>
      v2Post<DiscordBYOBSetupResponse>(
        `/products/${productId}/integrations/discord/byob/`,
        {
          bot_token: discordBotToken,
          ...(guildId ? { guild_id: guildId } : {}),
        }
      ),
    onError: () => {
      toast.error("Failed to connect. Check your bot token and try again.");
    },
  });

  const discordVerifyMutation = useMutation({
    mutationFn: () =>
      v2Post<VerifyResult>(
        `/products/${productId}/integrations/discord/verify/`,
        {}
      ),
  });

  const allChannels = Object.keys(CHANNEL_LABELS) as AgentChannel[];

  const handleAddAgent = (channel: AgentChannel) => {
    if (channel === "slack") {
      setSlackAgentName(`${productName} Slack`);
      setSlackStep("name");
      return;
    }
    if (channel === "discord") {
      setDiscordAgentName(`${productName} Discord`);
      setDiscordSlashName(productName.toLowerCase().replace(/[^a-z0-9_-]/g, "") || "pillar");
      setDiscordStep("setup");
      return;
    }
    createAgent.mutate({
      productId,
      data: {
        name: `${productName} ${CHANNEL_LABELS[channel]}`,
        channel,
      },
    });
  };

  const handleSlackOAuth = () => {
    createAgent.mutate(
      {
        productId,
        data: { name: slackAgentName, channel: "slack" },
      },
      {
        onSuccess: (newAgent) => {
          oauthInstallMutation.mutate(newAgent.id);
        },
      }
    );
  };

  const handleSlackBYOB = () => {
    createAgent.mutate(
      {
        productId,
        data: { name: slackAgentName, channel: "slack" },
      },
      {
        onSuccess: (newAgent) => {
          byobMutation.mutate(newAgent.id, {
            onSuccess: () => {
              resetSlackWizard();
              setShowAddDialog(false);
              router.push(`/agents/${newAgent.id}`);
            },
          });
        },
      }
    );
  };

  const resetSlackWizard = () => {
    setSlackStep(null);
    setSlackAgentName("");
    setBotToken("");
    setSigningSecret("");
    setSlackAppId("");
    byobMutation.reset();
    createAgent.reset();
  };

  const applyByobResult = (data: DiscordBYOBSetupResponse) => {
    if (data.application_id) setDiscordApplicationId(data.application_id);
    if (data.message_content_intent) {
      setDiscordMessageContentOk(data.message_content_intent !== 'not_enabled');
    }
    if (data.status === 'needs_guild') {
      setDiscordInviteUrl(data.invite_url!);
      setDiscordInteractionsUrl(data.interactions_url!);
      setDiscordGuilds([]);
      setDiscordInstallationCreated(false);
    } else if (data.status === 'select_guild') {
      setDiscordGuilds(data.guilds!);
      setDiscordInteractionsUrl(data.interactions_url!);
      setDiscordInviteUrl('');
      setDiscordInstallationCreated(false);
    } else {
      if (data.installation?.application_id) {
        setDiscordApplicationId(data.installation.application_id);
      }
      setDiscordGuildName(data.installation!.guild_name);
      setDiscordInteractionsUrl(data.interactions_url!);
      setDiscordInviteUrl(data.invite_url || '');
      setDiscordSlashRegistered(data.slash_commands_registered ?? false);
      setDiscordInstallationCreated(true);
    }
  };

  const handleDiscordBYOB = (guildId?: string) => {
    discordByobMutation.mutate(guildId, {
      onSuccess: (data) => {
        applyByobResult(data);
        setDiscordStep("interactions");
      },
    });
  };

  const handleRecheck = async () => {
    setIsRechecking(true);
    discordVerifyMutation.reset();
    if (discordInstallationCreated && discordSlashName) {
      try {
        await v2Patch(`/products/${productId}/integrations/discord/`, {
          slash_command_name: discordSlashName,
        });
      } catch { /* verify will show actual status */ }
    }
    discordVerifyMutation.mutate(undefined, {
      onSettled: () => setIsRechecking(false),
    });
  };

  const handleGoToChecklist = async () => {
    if (discordInstallationCreated && discordSlashName) {
      try {
        const result = await v2Patch<{ slash_commands_registered?: boolean }>(
          `/products/${productId}/integrations/discord/`,
          { slash_command_name: discordSlashName },
        );
        queryClient.invalidateQueries({ queryKey: ["discord-installation", productId] });
        if (result.slash_commands_registered === false) {
          toast.error("Failed to register slash commands with Discord. You can retry from the checklist.");
        }
      } catch {
        toast.error("Failed to update slash command name");
      }
    }
    setDiscordStep("checklist");
    discordVerifyMutation.mutate();
  };

  const resetDiscordWizard = () => {
    setDiscordStep(null);
    setDiscordAgentName("");
    setDiscordBotToken("");
    setDiscordGuildName("");
    setDiscordInteractionsUrl("");
    setDiscordInviteUrl("");
    setDiscordGuilds([]);
    setDiscordSelectedGuildId("");
    setDiscordSlashRegistered(false);
    setDiscordInstallationCreated(false);
    setDiscordApplicationId("");
    setDiscordMessageContentOk(null);
    setDiscordSlashName(productName.toLowerCase().replace(/[^a-z0-9_-]/g, "") || "pillar");
    discordByobMutation.reset();
    discordVerifyMutation.reset();
    createAgent.reset();
  };

  const handleDialogClose = (open: boolean) => {
    if (!open) {
      resetSlackWizard();
      resetDiscordWizard();
    }
    setShowAddDialog(open);
  };

  const isSlackSubmitting =
    createAgent.isPending ||
    byobMutation.isPending ||
    oauthInstallMutation.isPending;

  const isDiscordSubmitting = discordByobMutation.isPending;

  const activeWizard = slackStep ? "slack" : discordStep ? "discord" : null;

  const isChecklistChecking = isRechecking || discordVerifyMutation.isPending;
  const verifyData = discordVerifyMutation.data;
  let checkBotToken: boolean | null = null;
  let checkMessageContent: boolean | null = null;
  let checkGuild: boolean | null = null;
  let checkSlash: boolean | null = null;
  if (verifyData) {
    checkBotToken = verifyData.bot_token_valid;
    checkMessageContent = verifyData.message_content_intent;
    checkGuild = verifyData.guild_accessible;
    checkSlash = verifyData.slash_commands_registered;
  } else if (isChecklistChecking) {
    checkBotToken = discordMessageContentOk !== null ? true : null;
    checkMessageContent = discordMessageContentOk;
    checkGuild = null;
    checkSlash = null;
  } else if (!discordInstallationCreated) {
    checkBotToken = true;
    checkMessageContent = discordMessageContentOk;
    checkGuild = false;
    checkSlash = false;
  } else {
    checkBotToken = true;
    checkMessageContent = discordMessageContentOk;
    checkGuild = true;
    checkSlash = discordSlashRegistered;
  }
  const checklistAllOk =
    checkBotToken === true && checkMessageContent === true &&
    checkGuild === true && checkSlash === true;

  if (isAgentsPending) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-[72px] w-full" />
        <Skeleton className="h-[72px] w-full" />
      </div>
    );
  }

  if (isAgentsError) {
    return (
      <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
        <p className="text-sm text-destructive">Failed to load agents.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {agents && agents.length > 0 ? (
          agents.map((agent) => <AgentCard key={agent.id} agent={agent} />)
        ) : (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No agents configured yet. Add one to get started.
            </p>
          </div>
        )}
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowAddDialog(true)}
      >
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Add Agent
      </Button>

      <ProductDefaultsSection
        productId={productId}
        agentGuidance={agentGuidance}
        defaultLanguage={defaultLanguage}
        onSaved={onProductRefetch}
      />

      <Dialog open={showAddDialog} onOpenChange={handleDialogClose}>
        <DialogContent className={slackStep === "byob" ? "max-w-2xl" : (slackStep || discordStep) ? "max-w-lg" : "sm:max-w-md"}>
          {!activeWizard ? (
            <>
              <DialogHeader>
                <DialogTitle>Add Agent</DialogTitle>
                <DialogDescription>
                  Select a channel. Multiple agents can serve the same channel.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-2 py-2">
                {allChannels.map((channel) => {
                  const Icon = CHANNEL_ICONS[channel] || Globe;
                  const comingSoon = channel === "email";
                  return (
                    <Button
                      key={channel}
                      variant="outline"
                      className="justify-start gap-3 h-12"
                      onClick={() => handleAddAgent(channel)}
                      disabled={createAgent.isPending || comingSoon}
                    >
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      {CHANNEL_LABELS[channel]}
                      {comingSoon && (
                        <span className="ml-auto text-xs text-muted-foreground">Coming Soon</span>
                      )}
                    </Button>
                  );
                })}
              </div>
            </>
          ) : slackStep === "name" ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  <button
                    onClick={resetSlackWizard}
                    className="inline-flex items-center gap-1.5 text-sm font-normal text-muted-foreground hover:text-foreground mr-2"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </button>
                  Add Slack Agent
                </DialogTitle>
                <DialogDescription>
                  Name your agent and choose how to connect it to Slack.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label htmlFor="slack-agent-name">Agent Name</Label>
                  <Input
                    id="slack-agent-name"
                    value={slackAgentName}
                    onChange={(e) => setSlackAgentName(e.target.value)}
                    placeholder="e.g. Acme Slack"
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={() => setSlackStep("bot-type")}
                  disabled={!slackAgentName.trim()}
                >
                  Continue
                </Button>
              </div>
            </>
          ) : slackStep === "bot-type" ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  <button
                    onClick={() => setSlackStep("name")}
                    className="inline-flex items-center gap-1.5 text-sm font-normal text-muted-foreground hover:text-foreground mr-2"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </button>
                  Connect to Slack
                </DialogTitle>
                <DialogDescription>
                  Choose how to connect &ldquo;{slackAgentName}&rdquo; to Slack.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 py-2">
                <Button
                  variant="outline"
                  className="h-auto justify-start gap-3 p-4 text-left"
                  onClick={handleSlackOAuth}
                  disabled={isSlackSubmitting}
                >
                  <ExternalLink className="h-5 w-5 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="font-medium">
                      {createAgent.isPending || oauthInstallMutation.isPending
                        ? "Redirecting to Slack..."
                        : "Use Pillar\u2019s bot"}
                    </p>
                    <p className="text-xs text-muted-foreground font-normal">
                      One-click setup via Slack OAuth. Quick and easy.
                    </p>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto justify-start gap-3 p-4 text-left"
                  onClick={() => setSlackStep("byob")}
                  disabled={isSlackSubmitting}
                >
                  <Bot className="h-5 w-5 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Create your own bot</p>
                    <p className="text-xs text-muted-foreground font-normal">
                      Use your own Slack app with custom name and avatar.
                    </p>
                  </div>
                </Button>
              </div>
            </>
          ) : slackStep === "byob" ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  <button
                    onClick={() => setSlackStep("bot-type")}
                    className="inline-flex items-center gap-1.5 text-sm font-normal text-muted-foreground hover:text-foreground mr-2"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </button>
                  Create Your Own Slack Bot
                </DialogTitle>
                <DialogDescription>
                  Set up a custom Slack app for &ldquo;{slackAgentName}&rdquo;.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <StepNumber n={1} />
                    <p className="text-sm font-medium">Copy this manifest</p>
                  </div>
                  {isManifestPending ? (
                    <Skeleton className="h-32 w-full" />
                  ) : (
                    <div className="space-y-2">
                      <div className="max-h-48 overflow-auto rounded-md border bg-muted">
                        <pre className="p-3 text-xs leading-relaxed">
                          {manifestJson}
                        </pre>
                      </div>
                      <CopyButton text={manifestJson} label="Copy Manifest" />
                    </div>
                  )}
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <StepNumber n={2} />
                    <p className="text-sm font-medium">Create your Slack app</p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Go to{" "}
                    <a
                      href="https://api.slack.com/apps?new_app=1"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      api.slack.com/apps
                    </a>
                    , select the <strong>workspace</strong> you want to add the
                    bot to, choose <strong>From a manifest</strong>, select the
                    JSON tab, and paste the manifest above.
                  </p>
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <StepNumber n={3} />
                    <p className="text-sm font-medium">
                      Install the app to your workspace
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    In your Slack app settings, click{" "}
                    <strong>Install App</strong> in the left sidebar, then{" "}
                    <strong>Install to Workspace</strong>. This generates the bot
                    token you&apos;ll need in the next step.
                  </p>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <StepNumber n={4} />
                    <p className="text-sm font-medium">
                      Paste your credentials
                    </p>
                  </div>
                  <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                    <li>
                      <strong>Bot User OAuth Token</strong> — go to{" "}
                      <strong>OAuth &amp; Permissions</strong>, copy the token
                      starting with{" "}
                      <code className="text-xs bg-muted px-1 py-0.5 rounded">
                        xoxb-
                      </code>
                    </li>
                    <li>
                      <strong>Signing Secret</strong> — go to{" "}
                      <strong>Basic Information → App Credentials</strong>
                    </li>
                    <li>
                      <strong>App ID</strong> — found at the top of{" "}
                      <strong>Basic Information</strong> (e.g.{" "}
                      <code className="text-xs bg-muted px-1 py-0.5 rounded">
                        A07...
                      </code>
                      )
                    </li>
                  </ul>
                  <div className="space-y-1.5">
                    <Label htmlFor="byob-bot-token">
                      Bot User OAuth Token
                    </Label>
                    <Input
                      id="byob-bot-token"
                      type="password"
                      placeholder="xoxb-..."
                      value={botToken}
                      onChange={(e) => setBotToken(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="byob-signing-secret">Signing Secret</Label>
                    <Input
                      id="byob-signing-secret"
                      type="password"
                      placeholder="Paste signing secret..."
                      value={signingSecret}
                      onChange={(e) => setSigningSecret(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="byob-app-id">App ID</Label>
                    <Input
                      id="byob-app-id"
                      placeholder="A07..."
                      value={slackAppId}
                      onChange={(e) => setSlackAppId(e.target.value)}
                    />
                  </div>
                </div>

                {(byobMutation.isError || createAgent.isError) && (
                  <p className="text-sm text-destructive">
                    {(byobMutation.error as Error & { message?: string })
                      ?.message ||
                      "Failed to connect. Check your bot token and try again."}
                  </p>
                )}

                <Button
                  onClick={handleSlackBYOB}
                  disabled={
                    !botToken || !signingSecret || !slackAppId || isSlackSubmitting
                  }
                  className="w-full"
                >
                  {isSlackSubmitting
                    ? "Creating agent..."
                    : "Create Agent & Connect"}
                </Button>
              </div>
            </>
          ) : discordStep === "setup" ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  <button
                    onClick={resetDiscordWizard}
                    className="inline-flex items-center gap-1.5 text-sm font-normal text-muted-foreground hover:text-foreground mr-2"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </button>
                  Connect Discord Bot
                </DialogTitle>
                <DialogDescription>
                  Connect your own Discord bot with a custom name and avatar.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="discord-agent-name">Agent Name</Label>
                  <Input
                    id="discord-agent-name"
                    value={discordAgentName}
                    onChange={(e) => setDiscordAgentName(e.target.value)}
                    placeholder="e.g. Acme Discord"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="discord-bot-token">Bot Token</Label>
                  <Input
                    id="discord-bot-token"
                    type="password"
                    placeholder="Paste bot token..."
                    value={discordBotToken}
                    onChange={(e) => setDiscordBotToken(e.target.value)}
                  />
                </div>

                <ol className="space-y-2 pl-1 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <StepNumber n={1} />
                    <span>
                      <a
                        href="https://discord.com/developers/applications?new_application=true"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        Create a new Discord application
                      </a>
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <StepNumber n={2} />
                    <span>
                      Go to the <strong>Bot</strong> tab, click <strong>Reset Token</strong>, and copy it
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <StepNumber n={3} />
                    <span>
                      Enable <strong>MESSAGE CONTENT</strong> intent on the same page (located under Privileged Gateway Intents). Be sure to Save Changes
                    </span>
                  </li>
                </ol>

                {(discordByobMutation.isError || createAgent.isError) && (
                  <p className="text-sm text-destructive">
                    {(discordByobMutation.error as Error & { message?: string })
                      ?.message ||
                      "Failed to connect. Check your bot token and try again."}
                  </p>
                )}

                <Button
                  onClick={() => handleDiscordBYOB()}
                  disabled={!discordBotToken.trim() || !discordAgentName.trim() || isDiscordSubmitting}
                  className="w-full"
                >
                  {isDiscordSubmitting ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    "Connect"
                  )}
                </Button>
              </div>
            </>
          ) : discordStep === "interactions" ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  <button
                    onClick={() => setDiscordStep("setup")}
                    className="inline-flex items-center gap-1.5 text-sm font-normal text-muted-foreground hover:text-foreground mr-2"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </button>
                  Interactions Endpoint URL
                </DialogTitle>
                <DialogDescription>
                  Set the interactions endpoint URL in your Discord application.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Interactions Endpoint URL</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      readOnly
                      value={discordInteractionsUrl}
                      className="font-mono text-xs"
                    />
                    <CopyButton text={discordInteractionsUrl} />
                  </div>
                </div>

                <Separator />

                <div className="space-y-1.5">
                  <Label htmlFor="discord-slash-name">Slash Command</Label>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm text-muted-foreground">/</span>
                    <Input
                      id="discord-slash-name"
                      value={discordSlashName}
                      onChange={(e) =>
                        setDiscordSlashName(
                          e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "")
                        )
                      }
                      placeholder={
                        productName.toLowerCase().replace(/[^a-z0-9_-]/g, "") || "pillar"
                      }
                      className="font-mono"
                      maxLength={32}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Users will type /{discordSlashName || "pillar"} ask and /{discordSlashName || "pillar"} connect
                  </p>
                </div>

                <Separator />

                <ol className="space-y-2 pl-1 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <StepNumber n={1} />
                    <span>Copy the URL above</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <StepNumber n={2} />
                    <span>
                      In your{" "}
                      <a
                        href="https://discord.com/developers/applications"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        Discord app settings
                      </a>
                      , go to <strong>General Information</strong>
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <StepNumber n={3} />
                    <span>
                      Paste into <strong>Interactions Endpoint URL</strong> and <strong>Save Changes</strong>
                    </span>
                  </li>
                </ol>

                <Button onClick={handleGoToChecklist} className="w-full">
                  Next
                </Button>
              </div>
            </>
          ) : discordStep === "checklist" ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  <button
                    onClick={() => setDiscordStep("interactions")}
                    className="inline-flex items-center gap-1.5 text-sm font-normal text-muted-foreground hover:text-foreground mr-2"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </button>
                  Connection Status
                </DialogTitle>
                <DialogDescription>
                  {checklistAllOk
                    ? "Everything looks good. Your Discord bot is ready."
                    : "Checking your Discord bot configuration."}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-3 rounded-lg border p-4">
                  <div className="flex items-center gap-3 text-sm">
                    {checkBotToken === null ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : checkBotToken ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive" />
                    )}
                    <span>Bot token valid</span>
                  </div>

                  <div className="flex items-center gap-3 text-sm">
                    {checkMessageContent === null ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : checkMessageContent ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive" />
                    )}
                    <span className="flex-1">Message content intent</span>
                    {checkMessageContent === false && discordApplicationId && (
                      <a
                        href={`https://discord.com/developers/applications/${discordApplicationId}/bot`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        Enable in Developer Portal
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-sm">
                    {checkGuild === null ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : checkGuild ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive" />
                    )}
                    <span className="flex-1">
                      {checkGuild === true && discordGuildName
                        ? `Connected to ${discordGuildName}`
                        : "Guild accessible"}
                    </span>
                    {checkGuild === false && discordInviteUrl && (
                      <a
                        href={discordInviteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        Add to Server
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>

                  {discordGuilds.length > 0 && checkGuild === false && (
                    <div className="ml-7 space-y-1.5">
                      <Label className="text-xs">Select a server</Label>
                      <select
                        className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        value={discordSelectedGuildId}
                        onChange={(e) => setDiscordSelectedGuildId(e.target.value)}
                      >
                        <option value="">Choose a server...</option>
                        {discordGuilds.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="flex items-center gap-3 text-sm">
                    {checkSlash === null ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : checkSlash ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive" />
                    )}
                    <span className="flex-1">Slash commands registered</span>
                    {checkSlash === false && !isChecklistChecking && (
                      <button
                        onClick={handleRecheck}
                        className="text-xs text-primary hover:underline"
                      >
                        Retry
                      </button>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <div>
                      <p>
                        <strong>DMs and @mentions, and slash commands</strong> (<code>/{discordSlashName || "pillar"} ask</code>, <code>/{discordSlashName || "pillar"} connect</code>)  can be used to interact with the agent.
                      </p>
                    </div>
                  </div>
                </div>

                {discordVerifyMutation.isError && (
                  <p className="text-xs text-destructive">
                    Failed to verify connection. Click Re-check to try again.
                  </p>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleRecheck}
                    disabled={isChecklistChecking}
                    className="flex-1"
                  >
                    {isChecklistChecking ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        Checking...
                      </>
                    ) : (
                      "Re-check"
                    )}
                  </Button>
                  <Button
                    onClick={() => {
                      createAgent.mutate(
                        {
                          productId,
                          data: { name: discordAgentName, channel: "discord" },
                        },
                        {
                          onSuccess: (newAgent) => {
                            queryClient.invalidateQueries({ queryKey: ["discord-installation", productId] });
                            toast.success("Discord agent created and connected");
                            resetDiscordWizard();
                            setShowAddDialog(false);
                            router.push(`/agents/${newAgent.id}`);
                          },
                        }
                      );
                    }}
                    disabled={!checklistAllOk || createAgent.isPending}
                    className="flex-1"
                  >
                    {createAgent.isPending ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Done"
                    )}
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
