"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Agent } from "@/types/agent";
import { CHANNEL_LABELS, TONE_LABELS } from "@/types/agent";
import { Globe, MessageSquare, Mail, Terminal, Hash, Pencil } from "lucide-react";
import Link from "next/link";

const CHANNEL_ICONS: Record<string, React.ElementType> = {
  web: Globe,
  slack: MessageSquare,
  discord: Hash,
  email: Mail,
  api: Terminal,
};

interface AgentCardProps {
  agent: Agent;
}

export function AgentCard({ agent }: AgentCardProps) {
  const Icon = CHANNEL_ICONS[agent.channel] || Globe;
  const toneLabel = agent.tone ? TONE_LABELS[agent.tone] : null;
  const toolCount =
    agent.tool_scope === "none"
      ? "None"
      : agent.tool_scope === "allowed"
        ? agent.tool_allowance_ids.length
        : agent.tool_scope === "restricted"
          ? `All except ${agent.tool_restriction_ids.length}`
          : "All";

  return (
    <Card className="group transition-colors hover:border-foreground/20">
      <CardContent className="flex items-center justify-between p-4">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Icon className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">
                {CHANNEL_LABELS[agent.channel] || agent.channel}
              </span>
              <Badge
                variant={agent.is_active ? "default" : "secondary"}
                className="text-[10px] px-1.5 py-0"
              >
                {agent.is_active ? "Active" : "Inactive"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              &quot;{agent.name}&quot;
              {toneLabel && <> &middot; {toneLabel} tone</>}
              {" "}&middot; {toolCount} tools
              {agent.include_sources && " · Sources enabled"}
            </p>
          </div>
        </div>

        <Button variant="ghost" size="sm" asChild>
          <Link href={`/agents/${agent.id}`}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            Edit
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
