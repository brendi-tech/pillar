"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, CheckCircle2, ClipboardCopy, Loader2, XCircle } from "lucide-react";
import { v2Fetch, v2Post } from "@/lib/admin/v2/api-client";

interface DiscordInstallation {
  id: string;
  guild_id: string;
  guild_name: string;
  bot_user_id: string;
  application_id: string;
  is_active: boolean;
  is_byob: boolean;
  config: Record<string, unknown>;
  slash_command_name?: string;
  created_at: string;
  updated_at: string;
}

function CopyableField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          readOnly
          value={value}
          className="font-mono text-xs"
          onFocus={(e) => e.target.select()}
        />
        <Button variant="outline" size="icon" className="shrink-0" onClick={handleCopy}>
          {copied ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <ClipboardCopy className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
    </div>
  );
}

interface VerifyResult {
  bot_token_valid: boolean;
  message_content_intent: boolean;
  guild_accessible: boolean;
  slash_commands_registered: boolean;
  all_ok: boolean;
}

interface DiscordConfigTabProps {
  productId: string;
}

export function DiscordConfigTab({ productId }: DiscordConfigTabProps) {
  const verifyMutation = useMutation({
    mutationFn: () =>
      v2Post<VerifyResult>(
        `/products/${productId}/integrations/discord/verify/`,
        {}
      ),
  });

  const { data: installation, isPending } = useQuery({
    queryKey: ["discord-installation", productId],
    queryFn: () =>
      v2Fetch<DiscordInstallation | null>(
        `/products/${productId}/integrations/discord/`
      ).catch(() => null),
    enabled: !!productId,
  });

  if (isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (!installation?.is_active) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
        <p className="text-sm text-amber-600 dark:text-amber-400">
          No Discord bot connected. Create a new Discord agent to set one up.
        </p>
      </div>
    );
  }

  const interactionsUrl = `${process.env.NEXT_PUBLIC_PILLAR_API_URL || "http://localhost:8003"}/api/integrations/discord/interactions/`;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Badge
          variant="outline"
          className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        >
          Connected
        </Badge>
        <span className="text-sm text-muted-foreground">
          {installation.guild_name}
        </span>
        {installation.is_byob && (
          <Badge variant="outline" className="text-xs">
            Custom Bot
          </Badge>
        )}
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-sm">Bot Token</Label>
          <Input
            readOnly
            value="••••••••••••••••••••••••••••"
            className="font-mono text-xs text-muted-foreground"
          />
          <p className="text-xs text-muted-foreground">
            Stored encrypted. To update, disconnect and reconnect.
          </p>
        </div>

        <CopyableField label="Guild ID" value={installation.guild_id} />

        <div className="space-y-1.5">
          <Label className="text-sm">Slash Command</Label>
          <Input
            readOnly
            value={`/${installation.slash_command_name || "pillar"}`}
            className="font-mono text-xs"
          />
        </div>

        {installation.is_byob && (
          <CopyableField label="Interactions Endpoint URL" value={interactionsUrl} />
        )}

        <div className="space-y-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => verifyMutation.mutate()}
            disabled={verifyMutation.isPending}
          >
            {verifyMutation.isPending ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Verifying...
              </>
            ) : (
              "Verify Connection"
            )}
          </Button>

          {verifyMutation.data && (
            <div className="space-y-1.5 rounded-lg border p-3">
              <div className="space-y-1 text-sm">
                <div className="flex items-center gap-2">
                  {verifyMutation.data.bot_token_valid ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-destructive" />
                  )}
                  Bot token valid
                </div>
                <div className="flex items-center gap-2">
                  {verifyMutation.data.message_content_intent ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-destructive" />
                  )}
                  Message content intent
                </div>
                <div className="flex items-center gap-2">
                  {verifyMutation.data.guild_accessible ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-destructive" />
                  )}
                  Guild accessible
                </div>
                <div className="flex items-center gap-2">
                  {verifyMutation.data.slash_commands_registered ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-destructive" />
                  )}
                  Slash commands registered
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
