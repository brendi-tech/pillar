"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { agentListQuery, agentKeys, createAgentMutation } from "@/queries/agent.queries";
import { AgentCard } from "./AgentCard";
import { ProductDefaultsSection } from "./ProductDefaultsSection";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { CHANNEL_LABELS, type AgentChannel } from "@/types/agent";
import { Plus, Globe, MessageSquare, Mail, Terminal, Hash } from "lucide-react";
import { toast } from "sonner";

const CHANNEL_ICONS: Record<string, React.ElementType> = {
  web: Globe,
  slack: MessageSquare,
  discord: Hash,
  email: Mail,
  api: Terminal,
};

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

  const {
    data: agents,
    isPending: isAgentsPending,
    isError: isAgentsError,
  } = useQuery(agentListQuery(productId));

  const createAgent = useMutation({
    ...createAgentMutation(),
    onSuccess: (newAgent) => {
      queryClient.invalidateQueries({ queryKey: agentKeys.lists() });
      setShowAddDialog(false);
      toast.success(`${CHANNEL_LABELS[newAgent.channel]} agent created`);
      router.push(`/agents/${newAgent.id}`);
    },
    onError: () => {
      toast.error("Failed to create agent");
    },
  });

  const allChannels = Object.keys(CHANNEL_LABELS) as AgentChannel[];

  const handleAddAgent = (channel: AgentChannel) => {
    createAgent.mutate({
      productId,
      data: {
        name: `${productName} ${CHANNEL_LABELS[channel]}`,
        channel,
      },
    });
  };

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

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Agent</DialogTitle>
            <DialogDescription>
              Select a channel. Multiple agents can serve the same channel.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            {allChannels.map((channel) => {
              const Icon = CHANNEL_ICONS[channel] || Globe;
              return (
                <Button
                  key={channel}
                  variant="outline"
                  className="justify-start gap-3 h-12"
                  onClick={() => handleAddAgent(channel)}
                  disabled={createAgent.isPending}
                >
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  {CHANNEL_LABELS[channel]}
                </Button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
