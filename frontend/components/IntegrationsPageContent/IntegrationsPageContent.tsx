"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useProduct } from "@/providers/ProductProvider";
import { v2Delete, v2Fetch, v2Post } from "@/lib/admin/v2/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  Bot,
  Check,
  ClipboardCopy,
  ExternalLink,
  Hash,
  MessageCircle,
  Plug2,
  Unplug,
} from "lucide-react";
import { useState } from "react";
import { PageHeader } from "../shared/PageHeader";

interface SlackInstallation {
  id: string;
  team_id: string;
  team_name: string;
  bot_user_id: string;
  is_active: boolean;
  is_byob: boolean;
  app_id: string;
  scopes: string[];
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface BYOBSetupResponse {
  installation: SlackInstallation;
  webhook_urls: {
    events: string;
    commands: string;
    interactions: string;
  };
  created: boolean;
}

interface DiscordInstallation {
  id: string;
  guild_id: string;
  guild_name: string;
  bot_user_id: string;
  is_active: boolean;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

const slackKeys = {
  all: ["slack-integration"] as const,
  installation: (productId: string) =>
    [...slackKeys.all, "installation", productId] as const,
};

const discordKeys = {
  all: ["discord-integration"] as const,
  installation: (productId: string) =>
    [...discordKeys.all, "installation", productId] as const,
};

const PageWrapper = ({ children }: { children: React.ReactNode }) => (
  <div className="h-full overflow-y-auto">
    <div className="space-y-6 p-page max-w-page mx-auto">
      <PageHeader
        title="Integrations"
        description="Connect your agent to Slack, Discord, and more"
      />
      {children}
    </div>
  </div>
);

function SlackIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.122 2.521a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.268 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zm-2.523 10.122a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.268a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
    </svg>
  );
}

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

function SlackConnectedCard({
  installation,
  productId,
}: {
  installation: SlackInstallation;
  productId: string;
}) {
  const queryClient = useQueryClient();

  const disconnect = useMutation({
    mutationFn: () =>
      v2Delete(`/products/${productId}/integrations/slack/`),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: slackKeys.installation(productId),
      });
    },
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#4A154B]/10">
              <SlackIcon className="h-5 w-5 text-[#4A154B] dark:text-[#E01E5A]" />
            </div>
            <div>
              <CardTitle className="text-base">Slack</CardTitle>
              <CardDescription>{installation.team_name}</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {installation.is_byob && (
              <Badge variant="outline" className="text-xs">
                <Bot className="mr-1 h-3 w-3" />
                Custom Bot
              </Badge>
            )}
            <Badge
              variant="outline"
              className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            >
              Connected
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Workspace</p>
            <p className="font-medium">{installation.team_name}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Connected</p>
            <p className="font-medium">
              {formatDistanceToNow(new Date(installation.created_at), {
                addSuffix: true,
              })}
            </p>
          </div>
        </div>
        <Separator />
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => disconnect.mutate()}
            disabled={disconnect.isPending}
            className="text-destructive hover:text-destructive"
          >
            <Unplug className="mr-1.5 h-3.5 w-3.5" />
            {disconnect.isPending ? "Disconnecting..." : "Disconnect"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CopyableUrl({ label, url }: { label: string; url: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2">
        <code className="flex-1 rounded bg-muted px-2 py-1 text-xs break-all">
          {url}
        </code>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={handleCopy}>
          {copied ? <Check className="h-3.5 w-3.5" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  );
}

const REQUIRED_SCOPES = [
  "app_mentions:read",
  "chat:write",
  "commands",
  "im:history",
  "im:read",
  "im:write",
  "reactions:read",
  "reactions:write",
  "users:read",
  "users:read.email",
];

function BYOBSetupDialog({
  open,
  onOpenChange,
  productId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
}) {
  const queryClient = useQueryClient();
  const [botToken, setBotToken] = useState("");
  const [signingSecret, setSigningSecret] = useState("");
  const [webhookUrls, setWebhookUrls] = useState<BYOBSetupResponse["webhook_urls"] | null>(null);

  const byobMutation = useMutation({
    mutationFn: () =>
      v2Post<BYOBSetupResponse>(
        `/products/${productId}/integrations/slack/byob/`,
        { bot_token: botToken, signing_secret: signingSecret }
      ),
    onSuccess: (data) => {
      setWebhookUrls(data.webhook_urls);
      queryClient.invalidateQueries({
        queryKey: slackKeys.installation(productId),
      });
    },
  });

  const handleClose = () => {
    onOpenChange(false);
    setBotToken("");
    setSigningSecret("");
    setWebhookUrls(null);
    byobMutation.reset();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Connect Your Own Slack Bot</DialogTitle>
          <DialogDescription>
            Use your own Slack app so the bot appears with your custom name and avatar.
          </DialogDescription>
        </DialogHeader>

        {webhookUrls ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
              <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                Bot connected successfully. Now configure these URLs in your Slack app:
              </p>
            </div>
            <div className="space-y-3">
              <CopyableUrl label="Event Subscriptions Request URL" url={webhookUrls.events} />
              <CopyableUrl label="Slash Commands Request URL" url={webhookUrls.commands} />
              <CopyableUrl label="Interactivity Request URL" url={webhookUrls.interactions} />
            </div>
            <p className="text-xs text-muted-foreground">
              Set these in your Slack app&apos;s settings at{" "}
              <a
                href="https://api.slack.com/apps"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                api.slack.com/apps
              </a>
              , then you&apos;re all set.
            </p>
            <Button onClick={handleClose} className="w-full">
              Done
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Accordion type="single" collapsible>
              <AccordionItem value="instructions">
                <AccordionTrigger className="text-sm">
                  Setup instructions
                </AccordionTrigger>
                <AccordionContent>
                  <ol className="list-decimal space-y-2 pl-4 text-sm text-muted-foreground">
                    <li>
                      Create a new Slack app at{" "}
                      <a
                        href="https://api.slack.com/apps"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        api.slack.com/apps
                      </a>
                    </li>
                    <li>Under OAuth &amp; Permissions, add these bot scopes:</li>
                    <li className="list-none -mt-1">
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                        {REQUIRED_SCOPES.join(", ")}
                      </code>
                    </li>
                    <li>Install the app to your workspace</li>
                    <li>
                      Copy the <strong>Bot User OAuth Token</strong> from OAuth &amp; Permissions
                    </li>
                    <li>
                      Copy the <strong>Signing Secret</strong> from Basic Information
                    </li>
                  </ol>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="bot-token">Bot Token</Label>
                <Input
                  id="bot-token"
                  type="password"
                  placeholder="xoxb-..."
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="signing-secret">Signing Secret</Label>
                <Input
                  id="signing-secret"
                  type="password"
                  placeholder="Paste signing secret..."
                  value={signingSecret}
                  onChange={(e) => setSigningSecret(e.target.value)}
                />
              </div>
            </div>

            {byobMutation.isError && (
              <p className="text-sm text-destructive">
                {(byobMutation.error as Error & { message?: string })?.message ||
                  "Failed to connect. Check your bot token and try again."}
              </p>
            )}

            <Button
              onClick={() => byobMutation.mutate()}
              disabled={!botToken || !signingSecret || byobMutation.isPending}
              className="w-full"
            >
              {byobMutation.isPending ? "Validating..." : "Connect Bot"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SlackDisconnectedCard({ productId }: { productId: string }) {
  const [byobOpen, setBYOBOpen] = useState(false);

  const connectMutation = useMutation({
    mutationFn: () =>
      v2Post<{ authorize_url: string }>(
        `/products/${productId}/integrations/slack/install/`,
        {}
      ),
    onSuccess: (data) => {
      window.location.href = data.authorize_url;
    },
  });

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#4A154B]/10">
              <SlackIcon className="h-5 w-5 text-[#4A154B] dark:text-[#E01E5A]" />
            </div>
            <div>
              <CardTitle className="text-base">Slack</CardTitle>
              <CardDescription>
                Let your team interact with the agent via @mentions and DMs
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-dashed p-4">
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />
                <span>@mention the bot or DM directly</span>
              </div>
              <div className="flex items-center gap-2">
                <Hash className="h-4 w-4" />
                <span>Works in any channel the bot is invited to</span>
              </div>
              <div className="flex items-center gap-2">
                <Plug2 className="h-4 w-4" />
                <span>Full access to your agent&apos;s tools and knowledge</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Button
              onClick={() => connectMutation.mutate()}
              disabled={connectMutation.isPending}
              className="w-full"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              {connectMutation.isPending ? "Redirecting to Slack..." : "Connect Slack"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setBYOBOpen(true)}
              className="w-full"
            >
              <Bot className="mr-2 h-4 w-4" />
              Connect Your Own Bot
            </Button>
          </div>
        </CardContent>
      </Card>
      <BYOBSetupDialog open={byobOpen} onOpenChange={setBYOBOpen} productId={productId} />
    </>
  );
}

function DiscordConnectedCard({
  installation,
  productId,
}: {
  installation: DiscordInstallation;
  productId: string;
}) {
  const queryClient = useQueryClient();

  const disconnect = useMutation({
    mutationFn: () =>
      v2Delete(`/products/${productId}/integrations/discord/`),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: discordKeys.installation(productId),
      });
    },
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#5865F2]/10">
              <DiscordIcon className="h-5 w-5 text-[#5865F2]" />
            </div>
            <div>
              <CardTitle className="text-base">Discord</CardTitle>
              <CardDescription>{installation.guild_name}</CardDescription>
            </div>
          </div>
          <Badge
            variant="outline"
            className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          >
            Connected
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Server</p>
            <p className="font-medium">{installation.guild_name}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Connected</p>
            <p className="font-medium">
              {formatDistanceToNow(new Date(installation.created_at), {
                addSuffix: true,
              })}
            </p>
          </div>
        </div>
        <Separator />
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => disconnect.mutate()}
            disabled={disconnect.isPending}
            className="text-destructive hover:text-destructive"
          >
            <Unplug className="mr-1.5 h-3.5 w-3.5" />
            {disconnect.isPending ? "Disconnecting..." : "Disconnect"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function DiscordDisconnectedCard({ productId }: { productId: string }) {
  const connectMutation = useMutation({
    mutationFn: () =>
      v2Post<{ authorize_url: string }>(
        `/products/${productId}/integrations/discord/install/`,
        {}
      ),
    onSuccess: (data) => {
      window.location.href = data.authorize_url;
    },
  });

  const handleConnect = () => {
    connectMutation.mutate();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#5865F2]/10">
            <DiscordIcon className="h-5 w-5 text-[#5865F2]" />
          </div>
          <div>
            <CardTitle className="text-base">Discord</CardTitle>
            <CardDescription>
              Bring your agent to Discord servers
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-dashed p-4">
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              <span>@mention the bot or DM directly</span>
            </div>
            <div className="flex items-center gap-2">
              <Hash className="h-4 w-4" />
              <span>Responds in threads to keep channels clean</span>
            </div>
            <div className="flex items-center gap-2">
              <Plug2 className="h-4 w-4" />
              <span>Full access to your agent&apos;s tools and knowledge</span>
            </div>
          </div>
        </div>
        <Button
          onClick={handleConnect}
          disabled={connectMutation.isPending}
          className="w-full"
        >
          <ExternalLink className="mr-2 h-4 w-4" />
          {connectMutation.isPending ? "Redirecting to Discord..." : "Connect Discord"}
        </Button>
      </CardContent>
    </Card>
  );
}

export function IntegrationsPageContent() {
  const { currentProduct, isLoading: isProductLoading } = useProduct();
  const productId = currentProduct?.id || "";

  const {
    data: slackInstallation,
    isPending: isSlackPending,
  } = useQuery({
    queryKey: slackKeys.installation(productId),
    queryFn: () =>
      v2Fetch<SlackInstallation | null>(
        `/products/${productId}/integrations/slack/`
      ).catch(() => null),
    enabled: !!productId,
  });

  const {
    data: discordInstallation,
    isPending: isDiscordPending,
  } = useQuery({
    queryKey: discordKeys.installation(productId),
    queryFn: () =>
      v2Fetch<DiscordInstallation | null>(
        `/products/${productId}/integrations/discord/`
      ).catch(() => null),
    enabled: !!productId,
  });

  if (isProductLoading) {
    return (
      <PageWrapper>
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <div className="grid gap-4 md:grid-cols-2">
        {isSlackPending ? (
          <Skeleton className="h-48 w-full" />
        ) : slackInstallation?.is_active ? (
          <SlackConnectedCard
            installation={slackInstallation}
            productId={productId}
          />
        ) : (
          <SlackDisconnectedCard productId={productId} />
        )}

        {isDiscordPending ? (
          <Skeleton className="h-48 w-full" />
        ) : discordInstallation?.is_active ? (
          <DiscordConnectedCard
            installation={discordInstallation}
            productId={productId}
          />
        ) : (
          <DiscordDisconnectedCard productId={productId} />
        )}
      </div>
    </PageWrapper>
  );
}
