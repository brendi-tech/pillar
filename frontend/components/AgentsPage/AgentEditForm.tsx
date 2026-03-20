"use client";

import { useState, useCallback, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import { PersonalityTab } from "./PersonalityTab";
import { ToolsTab } from "./ToolsTab";
import { ResponseTab } from "./ResponseTab";
import { ChannelSettingsTab } from "./ChannelSettingsTab";
import { KnowledgeTab } from "./KnowledgeTab";
import {
  updateAgentMutation,
  deleteAgentMutation,
  agentKeys,
} from "@/queries/agent.queries";
import type { Agent, UpdateAgentPayload } from "@/types/agent";
import { CHANNEL_LABELS } from "@/types/agent";
import { Loader2, Trash2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface AgentEditFormProps {
  agent: Agent;
  productGuidance: string;
}

export function AgentEditForm({ agent, productGuidance }: AgentEditFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Agent>(agent);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setDraft(agent);
    setIsDirty(false);
  }, [agent]);

  const handleChange = useCallback((updates: Partial<Agent>) => {
    setDraft((prev) => ({ ...prev, ...updates }));
    setIsDirty(true);
  }, []);

  const updateMutation = useMutation({
    ...updateAgentMutation(),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: agentKeys.detail(agent.id) });
      queryClient.invalidateQueries({ queryKey: agentKeys.lists() });
      setDraft(updated);
      setIsDirty(false);
      toast.success("Agent saved");
    },
    onError: () => {
      toast.error("Failed to save agent");
    },
  });

  const deleteMutation = useMutation({
    ...deleteAgentMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agentKeys.lists() });
      toast.success("Agent deleted");
      router.push("/agents");
    },
    onError: () => {
      toast.error("Failed to delete agent");
    },
  });

  const handleSave = () => {
    const payload: UpdateAgentPayload = {
      name: draft.name,
      is_active: draft.is_active,
      tone: draft.tone,
      guidance_override: draft.guidance_override,
      tool_allowlist: draft.tool_allowlist,
      tool_denylist: draft.tool_denylist,
      max_response_tokens: draft.max_response_tokens,
      include_sources: draft.include_sources,
      include_suggested_followups: draft.include_suggested_followups,
      llm_model: draft.llm_model === "_default" ? "" : draft.llm_model,
      temperature: draft.temperature,
      channel_config: draft.channel_config,
      default_language:
        draft.default_language === "_empty" ? "" : draft.default_language,
      knowledge_scope: draft.knowledge_scope,
      knowledge_source_ids: draft.knowledge_source_ids,
    };
    updateMutation.mutate({ id: agent.id, data: payload });
  };

  const handleDiscard = () => {
    setDraft(agent);
    setIsDirty(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/agents">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">{draft.name}</h2>
              <Badge variant="outline" className="text-xs">
                {CHANNEL_LABELS[agent.channel]}
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Active</span>
            <Switch
              checked={draft.is_active}
              onCheckedChange={(checked) => handleChange({ is_active: checked })}
            />
          </div>

          {isDirty && (
            <>
              <Button variant="ghost" size="sm" onClick={handleDiscard}>
                Discard
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending && (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                )}
                Save
              </Button>
            </>
          )}

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Agent</AlertDialogTitle>
                <AlertDialogDescription>
                  Deleting this agent will reset{" "}
                  {CHANNEL_LABELS[agent.channel]} to product defaults. Existing
                  conversations will retain a reference to this agent.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteMutation.mutate(agent.id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <Tabs defaultValue="personality">
        <TabsList>
          <TabsTrigger value="personality">Personality</TabsTrigger>
          <TabsTrigger value="tools">Tools</TabsTrigger>
          <TabsTrigger value="response">Response</TabsTrigger>
          <TabsTrigger value="channel">Channel Settings</TabsTrigger>
          <TabsTrigger value="knowledge">Knowledge</TabsTrigger>
        </TabsList>

        <TabsContent value="personality" className="mt-6">
          <PersonalityTab
            agent={draft}
            productGuidance={productGuidance}
            onChange={handleChange}
          />
        </TabsContent>

        <TabsContent value="tools" className="mt-6">
          <ToolsTab
            agent={draft}
            productId={agent.product}
            onChange={handleChange}
          />
        </TabsContent>

        <TabsContent value="response" className="mt-6">
          <ResponseTab agent={draft} onChange={handleChange} />
        </TabsContent>

        <TabsContent value="channel" className="mt-6">
          <ChannelSettingsTab agent={draft} onChange={handleChange} />
        </TabsContent>

        <TabsContent value="knowledge" className="mt-6">
          <KnowledgeTab
            agent={draft}
            productId={agent.product}
            onChange={handleChange}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
