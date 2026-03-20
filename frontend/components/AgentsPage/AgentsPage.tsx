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
import { v2Fetch, v2Post } from "@/lib/admin/v2/api-client";
import {
  Plus,
  Globe,
  MessageSquare,
  Mail,
  Terminal,
  Hash,
  Bot,
  ExternalLink,
  ArrowLeft,
  Check,
  ClipboardCopy,
} from "lucide-react";
import { toast } from "sonner";

const CHANNEL_ICONS: Record<string, React.ElementType> = {
  web: Globe,
  slack: MessageSquare,
  discord: Hash,
  email: Mail,
  api: Terminal,
};

type SlackStep = "name" | "bot-type" | "byob";

interface BYOBSetupResponse {
  installation: Record<string, unknown>;
  webhook_urls: {
    events: string;
    commands: string;
    interactions: string;
  };
  created: boolean;
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
    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
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

  const {
    data: agents,
    isPending: isAgentsPending,
    isError: isAgentsError,
  } = useQuery(agentListQuery(productId));

  const createAgent = useMutation({
    ...createAgentMutation(),
    onSuccess: (newAgent) => {
      queryClient.invalidateQueries({ queryKey: agentKeys.lists() });
      if (slackStep) return;
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

  const allChannels = Object.keys(CHANNEL_LABELS) as AgentChannel[];

  const handleAddAgent = (channel: AgentChannel) => {
    if (channel === "slack") {
      setSlackAgentName(`${productName} Slack`);
      setSlackStep("name");
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
    byobMutation.reset();
    createAgent.reset();
  };

  const handleDialogClose = (open: boolean) => {
    if (!open) resetSlackWizard();
    setShowAddDialog(open);
  };

  const isSlackSubmitting =
    createAgent.isPending ||
    byobMutation.isPending ||
    oauthInstallMutation.isPending;

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
        <DialogContent className={slackStep === "byob" ? "max-w-2xl" : slackStep ? "max-w-lg" : "sm:max-w-md"}>
          {!slackStep ? (
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
                  const comingSoon = channel === "discord" || channel === "email";
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
          ) : (
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
                    !botToken || !signingSecret || isSlackSubmitting
                  }
                  className="w-full"
                >
                  {isSlackSubmitting
                    ? "Creating agent..."
                    : "Create Agent & Connect"}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
