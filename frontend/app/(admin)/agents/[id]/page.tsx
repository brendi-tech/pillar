"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { agentDetailQuery } from "@/queries/agent.queries";
import { AgentEditForm } from "@/components/AgentsPage/AgentEditForm";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useProduct } from "@/providers";

export default function AgentEditPage() {
  const params = useParams<{ id: string }>();
  const { currentProduct } = useProduct();

  const {
    data: agent,
    isPending,
    isError,
  } = useQuery(agentDetailQuery(params.id));

  if (isPending) {
    return (
      <div className="h-full overflow-hidden">
        <ScrollArea className="h-full">
          <div className="space-y-6 p-page max-w-page mx-auto">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-8 w-full max-w-sm" />
            <Skeleton className="h-64 w-full" />
          </div>
        </ScrollArea>
      </div>
    );
  }

  if (isError || !agent) {
    return (
      <div className="h-full overflow-hidden">
        <ScrollArea className="h-full">
          <div className="space-y-6 p-page max-w-page mx-auto">
            <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
              <p className="text-sm text-destructive">
                Failed to load agent. It may have been deleted.
              </p>
            </div>
          </div>
        </ScrollArea>
      </div>
    );
  }

  return (
    <div className="h-full overflow-hidden">
      <ScrollArea className="h-full">
        <div className="space-y-6 p-page max-w-page mx-auto">
          <AgentEditForm
            agent={agent}
            productGuidance={currentProduct?.agent_guidance || ""}
          />
        </div>
      </ScrollArea>
    </div>
  );
}
