'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  createKnowledgeSourceMutation,
  knowledgeKeys,
} from '@/queries/knowledge.queries';
import type {
  KnowledgeSourceType,
  KnowledgeCrawlConfig,
  KnowledgeSourceTypeOption,
  ConnectionConfig,
} from '@/types/knowledge';
import { KNOWLEDGE_SOURCE_TYPE_OPTIONS } from '@/types/knowledge';
import type { PendingUpload } from '@/types/sources';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { SelectSourceType } from './steps/SelectSourceType';
import { ConfigureUrl, type FieldErrors } from './steps/ConfigureUrl';
import { ConfigureCloudStorage } from './steps/ConfigureCloudStorage';
import { ConfigureDocumentUpload } from './steps/ConfigureDocumentUpload';
import { ReviewAndCreate } from './steps/ReviewAndCreate';
import { ApiValidationError } from '@/lib/admin/api-client';

interface WizardState {
  step: 1 | 2 | 3;
  sourceType: KnowledgeSourceTypeOption | null;
  name: string;
  url: string;
  crawlConfig: KnowledgeCrawlConfig;
  connectionConfig: ConnectionConfig;
  pendingUploads: PendingUpload[];
}

const FULL_STEPS = [
  { id: 1, name: 'Source Type', description: 'Choose type' },
  { id: 2, name: 'Configuration', description: 'Set up source' },
  { id: 3, name: 'Review', description: 'Confirm & create' },
];

const SIMPLE_STEPS = [
  { id: 1, name: 'Source Type', description: 'Choose type' },
  { id: 3, name: 'Create', description: 'Name & create' },
];

// Source types that skip the config step (snippets only - document_upload now has config step)
const SIMPLE_SOURCE_TYPES = ['snippets'];

export function AddKnowledgeSourceWizard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const [wizardState, setWizardState] = useState<WizardState>({
    step: 1,
    sourceType: null,
    name: '',
    url: '',
    crawlConfig: {
      max_pages: 100,
    },
    connectionConfig: {},
    pendingUploads: [],
  });

  const createMutation = useMutation({
    ...createKnowledgeSourceMutation(),
    onSuccess: (source) => {
      toast.success('Knowledge source created!');
      queryClient.invalidateQueries({ queryKey: knowledgeKeys.sources() });
      router.push(`/knowledge/${source.id}`);
    },
    onError: (error: Error) => {
      setIsSubmitting(false);
      
      // Handle field-level validation errors
      if (error instanceof ApiValidationError) {
        const errors: FieldErrors = {};
        
        // Map API field errors to our FieldErrors format
        for (const [field, messages] of Object.entries(error.fieldErrors)) {
          if (messages.length > 0) {
            errors[field] = messages[0];
          }
        }
        
        // If there are URL or crawl config errors, go back to step 2
        const hasConfigErrors = errors.url || errors.name || errors.crawl_config;
        if (hasConfigErrors && wizardState.sourceType?.requiresUrl) {
          setFieldErrors(errors);
          setWizardState((prev) => ({ ...prev, step: 2 }));
          toast.error('Please fix the errors and try again');
          return;
        }
        
        // Show generic error for other field errors
        toast.error(`Validation error: ${error.message}`);
        return;
      }
      
      // Generic error handling
      toast.error(`Failed to create source: ${error.message}`);
    },
  });

  const handleClearFieldError = (field: string) => {
    setFieldErrors((prev) => {
      const updated = { ...prev };
      delete updated[field];
      return updated;
    });
  };

  const handleSelectSourceType = (type: KnowledgeSourceTypeOption) => {
    // Simple types skip step 2 and go directly to create
    const skipConfigStep = SIMPLE_SOURCE_TYPES.includes(type.id);
    
    setWizardState((prev) => ({
      ...prev,
      sourceType: type,
      name: type.name,
      step: skipConfigStep ? 3 : 2,
    }));
  };

  const handleConfigureUrl = (url: string, name: string, crawlConfig: KnowledgeCrawlConfig) => {
    // Clear any previous field errors when proceeding
    setFieldErrors({});
    setWizardState((prev) => ({
      ...prev,
      url,
      name,
      crawlConfig,
      step: 3,
    }));
  };

  const handleConfigureCloudStorage = (name: string, connectionConfig: ConnectionConfig) => {
    setWizardState((prev) => ({
      ...prev,
      name,
      connectionConfig,
      step: 3,
    }));
  };

  const handleConfigureDocumentUpload = (name: string, pendingUploads: PendingUpload[]) => {
    setWizardState((prev) => ({
      ...prev,
      name,
      pendingUploads,
      step: 3,
    }));
  };

  const handlePendingUploadsChange = (pendingUploads: PendingUpload[]) => {
    setWizardState((prev) => ({
      ...prev,
      pendingUploads,
    }));
  };

  const handleBack = () => {
    setWizardState((prev) => {
      // Simple types go directly from step 3 to step 1
      const isSimpleType = prev.sourceType && SIMPLE_SOURCE_TYPES.includes(prev.sourceType.id);
      if (prev.step === 3 && isSimpleType) {
        return { ...prev, step: 1 };
      }
      return {
        ...prev,
        step: (prev.step - 1) as 1 | 2 | 3,
      };
    });
  };

  const handleNameChange = (name: string) => {
    setWizardState((prev) => ({ ...prev, name }));
  };

  const handleCreate = () => {
    if (!wizardState.sourceType) return;

    setIsSubmitting(true);

    const sourceType = wizardState.sourceType.id as KnowledgeSourceType;

    createMutation.mutate({
      source_type: sourceType,
      name: wizardState.name,
      // URL and crawl_config for help_center and marketing_site
      url: wizardState.sourceType.requiresUrl ? wizardState.url : undefined,
      crawl_config: wizardState.sourceType.requiresUrl ? wizardState.crawlConfig : undefined,
      // connection_config for cloud_storage
      connection_config: wizardState.sourceType.requiresCredentials 
        ? wizardState.connectionConfig 
        : undefined,
      // pending_upload_ids for document_upload
      pending_upload_ids: wizardState.sourceType.requiresUpload && wizardState.pendingUploads.length > 0
        ? wizardState.pendingUploads.map(u => u.id)
        : undefined,
    });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-page">
      {/* Header */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/knowledge')}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Knowledge
        </Button>
        <h1 className="text-2xl font-bold">Add Knowledge Source</h1>
        <p className="text-muted-foreground">
          Connect a knowledge source to give your AI assistant more context.
        </p>
      </div>

      {/* Progress Steps */}
      {(() => {
        const isSimpleType = wizardState.sourceType && SIMPLE_SOURCE_TYPES.includes(wizardState.sourceType.id);
        const steps = isSimpleType ? SIMPLE_STEPS : FULL_STEPS;
        
        return (
          <div className="flex items-center gap-2">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                    wizardState.step === step.id
                      ? 'bg-primary text-primary-foreground'
                      : wizardState.step > step.id
                      ? 'bg-primary/20 text-primary'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {wizardState.step > step.id ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    index + 1
                  )}
                </div>
                <div className="ml-2 hidden sm:block">
                  <p className="text-sm font-medium">{step.name}</p>
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                </div>
                {index < steps.length - 1 && (
                  <div className="mx-4 h-px w-8 bg-border" />
                )}
              </div>
            ))}
          </div>
        );
      })()}

      {/* Step Content */}
      <Card>
        <CardContent className="pt-6">
          {wizardState.step === 1 && (
            <SelectSourceType
              options={KNOWLEDGE_SOURCE_TYPE_OPTIONS}
              selected={wizardState.sourceType}
              onSelect={handleSelectSourceType}
            />
          )}

          {wizardState.step === 2 && wizardState.sourceType && (
            <>
              {/* URL-based sources (help_center, marketing_site) */}
              {wizardState.sourceType.requiresUrl && (
                <ConfigureUrl
                  sourceType={wizardState.sourceType}
                  url={wizardState.url}
                  name={wizardState.name}
                  crawlConfig={wizardState.crawlConfig}
                  onSubmit={handleConfigureUrl}
                  onBack={handleBack}
                  fieldErrors={fieldErrors}
                  onClearFieldError={handleClearFieldError}
                />
              )}

              {/* Cloud storage sources */}
              {wizardState.sourceType.requiresCredentials && (
                <ConfigureCloudStorage
                  name={wizardState.name}
                  connectionConfig={wizardState.connectionConfig}
                  onSubmit={handleConfigureCloudStorage}
                  onBack={handleBack}
                />
              )}

              {/* Document upload sources */}
              {wizardState.sourceType.requiresUpload && (
                <ConfigureDocumentUpload
                  name={wizardState.name}
                  pendingUploads={wizardState.pendingUploads}
                  onSubmit={handleConfigureDocumentUpload}
                  onPendingUploadsChange={handlePendingUploadsChange}
                  onBack={handleBack}
                />
              )}
            </>
          )}

          {wizardState.step === 3 && wizardState.sourceType && (
            <ReviewAndCreate
              sourceType={wizardState.sourceType}
              name={wizardState.name}
              url={wizardState.url}
              crawlConfig={wizardState.crawlConfig}
              connectionConfig={wizardState.connectionConfig}
              pendingUploads={wizardState.pendingUploads}
              onBack={handleBack}
              onCreate={handleCreate}
              onNameChange={handleNameChange}
              isSubmitting={isSubmitting}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
