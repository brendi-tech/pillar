"use client";

import { Card, CardContent } from "@/components/ui/card";
import {
  createSource,
  createSnippet,
  triggerSync,
  uploadDocuments,
  type CreateKnowledgeSourceRequest,
} from "@/lib/admin/sources-api";
import { knowledgeKeys } from "@/queries/knowledge.queries";
import { knowledgeSourceKeys } from "@/queries/sources.queries";
import type {
  KnowledgeSourceTypeOption,
  CrawlConfig,
  ConnectionConfig,
} from "@/types/sources";
import { KNOWLEDGE_SOURCE_TYPES } from "@/types/sources";
import { useQueryClient } from "@tanstack/react-query";
import { Cloud, FileText, Globe, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Pillar } from "@pillar-ai/sdk";
import {
  WebsiteCrawlForm,
  CloudStorageForm,
  DocumentUploadForm,
  SnippetForm,
} from "./forms";

// =============================================================================
// Types
// =============================================================================

interface AddSourceWizardProps {
  /** When true, the wizard is embedded in another flow */
  embedded?: boolean;
  /** Callback when wizard completes (for embedded mode) */
  onComplete?: (sourceId: string) => void;
  /** Callback when user cancels (for embedded mode) */
  onCancel?: () => void;
  /** Hide the card wrapper (for embedding in another card) */
  hideCard?: boolean;
}

type WizardStep = 1 | 2;

interface WizardState {
  step: WizardStep;
  selectedType: KnowledgeSourceTypeOption | null;
}

// =============================================================================
// Icon Component
// =============================================================================

function SourceTypeIcon({ icon, className }: { icon: string; className?: string }) {
  switch (icon) {
    case 'Globe':
      return <Globe className={className} />;
    case 'Cloud':
      return <Cloud className={className} />;
    case 'Upload':
      return <Upload className={className} />;
    case 'FileText':
      return <FileText className={className} />;
    default:
      return <FileText className={className} />;
  }
}

// =============================================================================
// Main Component
// =============================================================================

export function AddSourceWizard({
  embedded = false,
  onComplete,
  onCancel,
  hideCard = false,
}: AddSourceWizardProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [wizardState, setWizardState] = useState<WizardState>({
    step: 1,
    selectedType: null,
  });

  // =============================================================================
  // Navigation
  // =============================================================================

  const handleTypeSelect = (type: KnowledgeSourceTypeOption) => {
    setWizardState({
      selectedType: type,
      step: 2,
    });
  };

  const handleBack = () => {
    setWizardState({
      step: 1,
      selectedType: null,
    });
  };

  const handleCancel = () => {
    if (embedded && onCancel) {
      onCancel();
    } else {
      router.push("/knowledge");
    }
  };

  // =============================================================================
  // Submit Handlers
  // =============================================================================

  const handleCreateSource = async (payload: CreateKnowledgeSourceRequest) => {
    setIsSubmitting(true);

    try {
      const newSource = await createSource(payload);

      // Trigger initial sync for crawl-based sources
      if (payload.source_type === 'website_crawl') {
        try {
          await triggerSync(newSource.id);
        } catch (syncErr) {
          console.warn("Failed to trigger initial sync:", syncErr);
        }
      }

      toast.success("Knowledge source added!", {
        description: `${payload.name} has been configured.`,
      });

      // Signal action completion (advances plan if one is active)
      Pillar.getInstance()?.completeAction('add_new_source', true, {
        sourceId: newSource.id,
        sourceName: payload.name,
      });

      // Refetch sources cache so the sidebar shows the new source immediately
      await queryClient.refetchQueries({ queryKey: knowledgeSourceKeys.lists() });

      if (embedded && onComplete) {
        onComplete(newSource.id);
      } else {
        // Redirect to source detail page
        router.push(`/knowledge/${newSource.id}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create source";
      toast.error("Failed to add source", { description: message });
      setIsSubmitting(false);
    }
  };

  const handleWebsiteCrawlSubmit = (data: { name: string; url: string; crawl_config: CrawlConfig }) => {
    handleCreateSource({
      source_type: 'website_crawl',
      name: data.name,
      url: data.url,
      crawl_config: data.crawl_config,
    });
  };

  const handleCloudStorageSubmit = (data: { name: string; connection_config: ConnectionConfig }) => {
    handleCreateSource({
      source_type: 'cloud_storage',
      name: data.name,
      connection_config: data.connection_config,
    });
  };

  const handleDocumentUploadSubmit = async (data: { name: string; files: File[] }) => {
    setIsSubmitting(true);

    try {
      // First create the source
      const newSource = await createSource({
        source_type: 'document_upload',
        name: data.name || 'Uploaded Documents',
      });

      // Then upload all files
      if (data.files.length > 0) {
        await uploadDocuments(newSource.id, data.files);
      }

      toast.success("Documents uploaded!", {
        description: `${data.files.length} file(s) uploaded to ${data.name || 'Uploaded Documents'}.`,
      });

      // Signal action completion (advances plan if one is active)
      Pillar.getInstance()?.completeAction('add_new_source', true, {
        sourceId: newSource.id,
        sourceName: data.name || 'Uploaded Documents',
      });

      // Refetch sources cache so the sidebar shows the new source with correct item count
      await queryClient.refetchQueries({ queryKey: knowledgeSourceKeys.lists() });
      // Also invalidate items cache so the expanded source shows the uploaded items
      await queryClient.invalidateQueries({ queryKey: knowledgeKeys.items() });

      if (embedded && onComplete) {
        onComplete(newSource.id);
      } else {
        router.push(`/knowledge/${newSource.id}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to upload documents";
      toast.error("Failed to upload", { description: message });
      setIsSubmitting(false);
    }
  };

  const handleSnippetSubmit = async (data: { name: string; content: string }) => {
    setIsSubmitting(true);

    try {
      const snippet = await createSnippet({
        title: data.name,
        content: data.content,
        is_active: true,
      });

      toast.success("Snippet created!", {
        description: `"${data.name}" has been added.`,
      });

      // Signal action completion (advances plan if one is active)
      Pillar.getInstance()?.completeAction('add_new_source', true, {
        sourceId: snippet.id,
        sourceName: data.name,
      });

      // Refetch sources cache so the sidebar shows the new source immediately
      await queryClient.refetchQueries({ queryKey: knowledgeSourceKeys.lists() });

      if (embedded && onComplete) {
        onComplete(snippet.id);
      } else {
        router.push("/knowledge");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create snippet";
      toast.error("Failed to create snippet", { description: message });
      setIsSubmitting(false);
    }
  };

  // =============================================================================
  // Render Step 1: Select Source Type
  // =============================================================================

  const renderSelectType = () => (
    <div className="space-y-3 sm:space-y-4">
      <div>
        <h2 className="text-base sm:text-lg font-semibold">Select Source Type</h2>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Choose what type of knowledge source you want to add.
        </p>
      </div>

      <div className="grid gap-2 sm:gap-3">
        {KNOWLEDGE_SOURCE_TYPES.map((type) => (
          <button
            key={type.id}
            onClick={() => handleTypeSelect(type)}
            className="flex items-center sm:items-start gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg border text-left transition-colors hover:bg-muted/50 border-border"
          >
            <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <SourceTypeIcon icon={type.icon} className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm sm:text-base font-medium">{type.name}</div>
              <div className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
                {type.description}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  // =============================================================================
  // Render Step 2: Type-Specific Form
  // =============================================================================

  const renderTypeForm = () => {
    if (!wizardState.selectedType) return null;

    switch (wizardState.selectedType.id) {
      case 'website_crawl':
        return (
          <WebsiteCrawlForm
            onBack={handleBack}
            onSubmit={handleWebsiteCrawlSubmit}
            isSubmitting={isSubmitting}
          />
        );
      
      case 'cloud_storage':
        return (
          <CloudStorageForm
            onBack={handleBack}
            onSubmit={handleCloudStorageSubmit}
            isSubmitting={isSubmitting}
          />
        );
      
      case 'document_upload':
        return (
          <DocumentUploadForm
            onBack={handleBack}
            onSubmit={handleDocumentUploadSubmit}
            isSubmitting={isSubmitting}
          />
        );
      
      case 'snippets':
        return (
          <SnippetForm
            onBack={handleBack}
            onSubmit={handleSnippetSubmit}
            isSubmitting={isSubmitting}
          />
        );
      
      default:
        return null;
    }
  };

  // =============================================================================
  // Render
  // =============================================================================

  const stepContent = wizardState.step === 1 ? renderSelectType() : renderTypeForm();

  if (hideCard) {
    return <div className="space-y-6">{stepContent}</div>;
  }

  return (
    <Card>
      <CardContent className="pt-6">{stepContent}</CardContent>
    </Card>
  );
}
