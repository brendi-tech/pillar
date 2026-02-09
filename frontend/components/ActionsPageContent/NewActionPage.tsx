"use client";

import { PageHeader } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { actionsAPI } from "@/lib/admin/actions-api";
import { useProduct } from "@/providers";
import { actionKeys } from "@/queries/actions.queries";
import type {
  ActionCreateRequest,
  ActionGenerationSuggestion,
  ActionTemplate,
  ActionUpdateRequest,
} from "@/types/actions";
import { deriveActionLabel } from "@/types/actions";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ActionForm } from "./ActionForm";
import { ActionTemplateSelector } from "./ActionTemplateSelector";

export function NewActionPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { currentProduct } = useProduct();
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] =
    useState<ActionTemplate | null>(null);
  const [showForm, setShowForm] = useState(false);

  const handleSelectTemplate = (template: ActionTemplate | null) => {
    setSelectedTemplate(template);
    setShowForm(true);
  };

  const handleStartFromScratch = () => {
    setSelectedTemplate(null);
    setShowForm(true);
  };

  const handleGenerateSuggestion = async (
    description: string
  ): Promise<ActionGenerationSuggestion> => {
    return actionsAPI.generateSuggestion(description);
  };

  const handleCreate = async (
    data: ActionCreateRequest | ActionUpdateRequest
  ) => {
    if (!currentProduct?.id) {
      setCreateError("Product not selected");
      return;
    }

    setIsCreating(true);
    setCreateError(null);
    try {
      // Since this is the new action page, data will always have required create fields
      const createData = data as ActionCreateRequest;
      const newAction = await actionsAPI.create({
        ...createData,
        help_center_config: currentProduct!.id,
      });
      queryClient.invalidateQueries({ queryKey: actionKeys.lists() });
      router.push(`/actions/${newAction.id}`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create action";
      setCreateError(message);
    } finally {
      setIsCreating(false);
    }
  };

  // Template selection view
  if (!showForm) {
    return (
      <div className="space-y-6 p-page">
        <PageHeader
          title="Create Action"
          description="Choose a template or start from scratch"
          actions={
            <Link href="/actions">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            </Link>
          }
        />

        <ActionTemplateSelector
          onSelectTemplate={handleSelectTemplate}
          onStartFromScratch={handleStartFromScratch}
        />
      </div>
    );
  }

  // Form view
  const initialData = selectedTemplate
    ? {
        name: selectedTemplate.name,
        description: selectedTemplate.description,
        action_type: selectedTemplate.action_type,
        path_template: selectedTemplate.path_template,
      }
    : undefined;

  // Derive title from template name or use default
  const pageTitle = selectedTemplate
    ? `Create: ${deriveActionLabel(selectedTemplate.name)}`
    : "Create Action";

  return (
    <div className="space-y-6 p-page">
      <PageHeader
        title={pageTitle}
        description="Define a new action that the AI can suggest to users"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowForm(false)}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Templates
            </Button>
          </div>
        }
      />

      {createError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {createError}
        </div>
      )}

      <ActionForm
        initialData={initialData}
        onSubmit={handleCreate}
        isLoading={isCreating}
        submitLabel="Create Action"
        isNew
        onGenerateSuggestion={handleGenerateSuggestion}
      />
    </div>
  );
}
