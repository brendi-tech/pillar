"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type {
  Action,
  ActionCreateRequest,
  ActionGenerationSuggestion,
  ActionType,
  ActionUpdateRequest,
} from "@/types/actions";
import {
  ACTION_TYPE_LABELS,
  ACTION_SOURCE_LABELS,
  deriveActionLabel,
  getActionTypeIcon,
} from "@/types/actions";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Check, ChevronDown, Loader2, Plus, RefreshCw, Save, Sparkles, Trash, X } from "lucide-react";
import { useState } from "react";
import { ActionPreviewCard } from "./ActionPreviewCard";
import { ActionTypeSelector } from "./ActionTypeSelector";

// ============================================================================
// Data Field Types
// ============================================================================

type DataFieldType = 'string' | 'number' | 'boolean' | 'array';

interface DataFieldDefinition {
  id: string;              // Unique ID for React key
  name: string;            // Field identifier (snake_case)
  type: DataFieldType;     // Field type
  description: string;     // Shown to LLM for extraction
  required: boolean;       // Must be extracted before action executes
  enumValues: string;      // Comma-separated enum values (optional)
  defaultValue: string;    // Default value as string (optional)
}

const FIELD_TYPES: { value: DataFieldType; label: string }[] = [
  { value: 'string', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'array', label: 'Array' },
];

// Convert data fields to JSON Schema format
function fieldsToSchema(fields: DataFieldDefinition[]): {
  data_schema: Record<string, unknown>;
  default_data: Record<string, unknown>;
} {
  if (fields.length === 0) {
    return { data_schema: {}, default_data: {} };
  }

  const properties: Record<string, Record<string, unknown>> = {};
  const required: string[] = [];
  const defaults: Record<string, unknown> = {};

  for (const field of fields) {
    if (!field.name.trim()) continue;

    const prop: Record<string, unknown> = {
      type: field.type,
      description: field.description || field.name,
    };

    // Handle enum values
    if (field.enumValues.trim()) {
      const enumVals = field.enumValues.split(',').map(v => v.trim()).filter(Boolean);
      if (enumVals.length > 0) {
        prop.enum = enumVals;
      }
    }

    // Handle array type
    if (field.type === 'array') {
      prop.items = { type: 'string' };
    }

    properties[field.name] = prop;

    if (field.required) {
      required.push(field.name);
    }

    // Handle default value
    if (field.defaultValue.trim()) {
      try {
        // Try to parse as JSON first (for arrays, booleans, numbers)
        defaults[field.name] = JSON.parse(field.defaultValue);
      } catch {
        // Fall back to string value
        defaults[field.name] = field.defaultValue;
      }
    }
  }

  return {
    data_schema: Object.keys(properties).length > 0
      ? { type: 'object', properties, required }
      : {},
    default_data: defaults,
  };
}

// Convert JSON Schema back to data fields (for editing existing actions)
function schemaToFields(
  dataSchema?: Record<string, unknown>,
  defaultData?: Record<string, unknown>
): DataFieldDefinition[] {
  if (!dataSchema || typeof dataSchema !== 'object') return [];

  const properties = dataSchema.properties as Record<string, Record<string, unknown>> | undefined;
  const required = (dataSchema.required as string[]) || [];

  if (!properties) return [];

  return Object.entries(properties).map(([name, prop]) => ({
    id: `field-${name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name,
    type: (prop.type as DataFieldType) || 'string',
    description: (prop.description as string) || '',
    required: required.includes(name),
    enumValues: Array.isArray(prop.enum) ? prop.enum.join(', ') : '',
    defaultValue: defaultData?.[name] !== undefined
      ? typeof defaultData[name] === 'string'
        ? defaultData[name] as string
        : JSON.stringify(defaultData[name])
      : '',
  }));
}

interface ActionFormProps {
  initialData?: Partial<Action>;
  onSubmit: (data: ActionCreateRequest | ActionUpdateRequest) => Promise<void>;
  isLoading?: boolean;
  submitLabel?: string;
  onDelete?: () => void;
  isNew?: boolean;
  onGenerateSuggestion?: (
    description: string
  ) => Promise<ActionGenerationSuggestion>;
}

type FormStep = "description" | "review";

export function ActionForm({
  initialData,
  onSubmit,
  isLoading = false,
  submitLabel = "Save",
  onDelete,
  isNew = false,
  onGenerateSuggestion,
}: ActionFormProps) {
  // Form step (for new actions)
  const [step, setStep] = useState<FormStep>(isNew ? "description" : "review");

  // Form state
  const [name, setName] = useState(initialData?.name ?? "");
  const [description, setDescription] = useState(
    initialData?.description ?? ""
  );
  const [actionType, setActionType] = useState<ActionType>(
    initialData?.action_type ?? "trigger_action"
  );
  const [pathTemplate, setPathTemplate] = useState(
    initialData?.path_template ?? ""
  );
  const [externalUrl, setExternalUrl] = useState(
    initialData?.external_url ?? ""
  );
  const [autoRun, setAutoRun] = useState(initialData?.auto_run ?? false);
  const [autoComplete, setAutoComplete] = useState(initialData?.auto_complete ?? false);

  // Data fields state
  const [dataFields, setDataFields] = useState<DataFieldDefinition[]>(() =>
    schemaToFields(
      initialData?.data_schema as Record<string, unknown> | undefined,
      initialData?.default_data as Record<string, unknown> | undefined
    )
  );
  const [isDataFieldsOpen, setIsDataFieldsOpen] = useState(dataFields.length > 0);

  // AI suggestion state
  const [isGenerating, setIsGenerating] = useState(false);
  const [suggestion, setSuggestion] =
    useState<ActionGenerationSuggestion | null>(null);
  const [suggestionApplied, setSuggestionApplied] = useState(false);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Convert data fields to JSON Schema format
    const { data_schema, default_data } = fieldsToSchema(dataFields);

    const data: ActionCreateRequest | ActionUpdateRequest = {
      name,
      description,
      action_type: actionType,
      path_template: actionType === "navigate" ? pathTemplate : undefined,
      external_url: actionType === "external_link" ? externalUrl : undefined,
      data_schema: Object.keys(data_schema).length > 0 ? data_schema : undefined,
      default_data: Object.keys(default_data).length > 0 ? default_data : undefined,
      auto_run: autoRun,
      auto_complete: autoComplete,
    };

    await onSubmit(data);
  };

  // Data field management handlers
  const addDataField = () => {
    const newField: DataFieldDefinition = {
      id: `field-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: '',
      type: 'string',
      description: '',
      required: false,
      enumValues: '',
      defaultValue: '',
    };
    setDataFields([...dataFields, newField]);
    setIsDataFieldsOpen(true);
  };

  const updateDataField = (id: string, updates: Partial<DataFieldDefinition>) => {
    setDataFields(fields =>
      fields.map(f => (f.id === id ? { ...f, ...updates } : f))
    );
  };

  const removeDataField = (id: string) => {
    setDataFields(fields => fields.filter(f => f.id !== id));
  };

  const handleGenerateSuggestion = async () => {
    if (
      !onGenerateSuggestion ||
      !description.trim() ||
      description.length < 10
    ) {
      return;
    }

    setIsGenerating(true);
    setSuggestionError(null);

    try {
      const result = await onGenerateSuggestion(description);
      setSuggestion(result);
      setSuggestionApplied(false);
    } catch {
      setSuggestionError("Failed to generate suggestion. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApplySuggestion = () => {
    if (!suggestion) return;

    setName(suggestion.identifier);
    setActionType(suggestion.action_type);
    if (suggestion.path_template) {
      setPathTemplate(suggestion.path_template);
    }
    if (suggestion.external_url) {
      setExternalUrl(suggestion.external_url);
    }
    setSuggestionApplied(true);
  };

  const handleProceedToReview = async () => {
    if (description.length < 10) return;

    // Generate suggestion when proceeding
    if (onGenerateSuggestion) {
      await handleGenerateSuggestion();
    }

    setStep("review");
  };

  // Derive preview label from name
  const previewLabel = name ? deriveActionLabel(name) : "Action Button";
  const previewIcon = getActionTypeIcon(actionType);

  // Description step (for new actions)
  if (isNew && step === "description") {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>What should this action do?</CardTitle>
            <CardDescription>
              Describe the action in plain English. Be specific about when the
              AI should suggest it.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Navigate the user to their account settings page where they can update their profile, change their password, and configure notification preferences."
              rows={5}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {description.length < 10
                ? `${10 - description.length} more characters needed`
                : `${description.length} characters`}
            </p>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button
            onClick={handleProceedToReview}
            disabled={description.length < 10 || isGenerating}
          >
            {isGenerating ? (
              <>
                <Sparkles className="mr-2 h-4 w-4 animate-pulse" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Action
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // Review/Edit step
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Form */}
        <div className="space-y-6 lg:col-span-2">
          {/* AI Suggestion Banner */}
          {suggestion && !suggestionApplied && (
            <Alert>
              <Sparkles className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>
                  AI suggests: <strong>{suggestion.identifier}</strong> (
                  {ACTION_TYPE_LABELS[suggestion.action_type]})
                  {suggestion.confidence >= 0.8 && " - High confidence"}
                </span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleApplySuggestion}
                  >
                    <Check className="mr-1 h-3 w-3" />
                    Apply
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={handleGenerateSuggestion}
                    disabled={isGenerating}
                  >
                    <RefreshCw
                      className={`h-3 w-3 ${isGenerating ? "animate-spin" : ""}`}
                    />
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {suggestionError && (
            <Alert variant="destructive">
              <AlertDescription>{suggestionError}</AlertDescription>
            </Alert>
          )}

          {/* Code-defined action warning */}
          {initialData?.source === 'code' && (
            <Alert>
              <AlertDescription className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                  Code
                </Badge>
                <span>
                  This action is defined in code. Edit the source code to make changes.
                </span>
              </AlertDescription>
            </Alert>
          )}

          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Action Description
                {initialData?.source && (
                  <Badge 
                    variant="secondary" 
                    className={initialData.source === 'code' 
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' 
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                    }
                  >
                    {ACTION_SOURCE_LABELS[initialData.source]}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                The AI uses this to understand when to suggest this action
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe when the AI should suggest this action..."
                rows={4}
                required
                disabled={initialData?.source === 'code'}
              />
              {isNew && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setStep("description")}
                >
                  ← Back to description
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Identifier */}
          <Card>
            <CardHeader>
              <CardTitle>Action Identifier</CardTitle>
              <CardDescription>
                Unique ID used by your SDK to handle this action
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="name">Identifier *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) =>
                    setName(
                      e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "")
                    )
                  }
                  placeholder="e.g., open_settings"
                  pattern="^[a-z][a-z0-9_]*$"
                  required
                  disabled={initialData?.source === 'code'}
                />
                <p className="text-xs text-muted-foreground">
                  Lowercase letters, numbers, and underscores only. Button label
                  derived as: <strong>{previewLabel}</strong>
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Action Type */}
          <Card>
            <CardHeader>
              <CardTitle>Action Type</CardTitle>
              <CardDescription>
                What happens when the user clicks the action button
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ActionTypeSelector 
                value={actionType} 
                onChange={setActionType} 
                disabled={initialData?.source === 'code'}
              />

              {/* Type-specific config */}
              {actionType === "navigate" && (
                <div className="mt-4 space-y-2">
                  <Label htmlFor="pathTemplate">Path Template *</Label>
                  <Input
                    id="pathTemplate"
                    value={pathTemplate}
                    onChange={(e) => setPathTemplate(e.target.value)}
                    placeholder="/settings/team?action=invite"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    URL path with optional {"{param}"} placeholders
                  </p>
                </div>
              )}

              {actionType === "external_link" && (
                <div className="mt-4 space-y-2">
                  <Label htmlFor="externalUrl">External URL *</Label>
                  <Input
                    id="externalUrl"
                    type="text"
                    value={externalUrl}
                    onChange={(e) => setExternalUrl(e.target.value)}
                    placeholder="https://docs.example.com"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Opens in a new browser tab
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Execution Behavior */}
          <Card>
            <CardHeader>
              <CardTitle>Execution Behavior</CardTitle>
              <CardDescription>
                Control how this action executes when suggested by the AI
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="autoRun">Auto-run when suggested</Label>
                  <p className="text-xs text-muted-foreground">
                    Executes immediately without requiring a button click
                  </p>
                </div>
                <Switch
                  id="autoRun"
                  checked={autoRun}
                  onCheckedChange={setAutoRun}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="autoComplete">Auto-complete after execution</Label>
                  <p className="text-xs text-muted-foreground">
                    Marks complete without waiting for host app confirmation
                  </p>
                </div>
                <Switch
                  id="autoComplete"
                  checked={autoComplete}
                  onCheckedChange={setAutoComplete}
                />
              </div>
              {autoRun && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  ⚠️ Auto-run is best for safe, reversible actions like navigation. 
                  Avoid for destructive actions like deletions or payments.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Data Fields (Advanced) */}
          <Card>
            <Collapsible open={isDataFieldsOpen} onOpenChange={setIsDataFieldsOpen}>
              <CardHeader className="pb-3">
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between text-left"
                  >
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        Data Fields
                        {dataFields.length > 0 && (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-normal text-primary">
                            {dataFields.length}
                          </span>
                        )}
                      </CardTitle>
                      <CardDescription>
                        Define data the AI should extract from user messages
                      </CardDescription>
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 text-muted-foreground transition-transform ${
                        isDataFieldsOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                </CollapsibleTrigger>
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="space-y-4 pt-0">
                  {dataFields.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-6 text-center">
                      <p className="text-sm text-muted-foreground mb-3">
                        No data fields defined. Add fields to extract information from user messages.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addDataField}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Data Field
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-4">
                        {dataFields.map((field, index) => (
                          <div
                            key={field.id}
                            className="rounded-lg border p-4 space-y-3"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-xs font-medium text-muted-foreground">
                                Field {index + 1}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => removeDataField(field.id)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                              {/* Field Name */}
                              <div className="space-y-1.5">
                                <Label className="text-xs">Field Name *</Label>
                                <Input
                                  value={field.name}
                                  onChange={(e) =>
                                    updateDataField(field.id, {
                                      name: e.target.value
                                        .toLowerCase()
                                        .replace(/[^a-z0-9_]/g, ""),
                                    })
                                  }
                                  placeholder="field_name"
                                  className="h-8 text-sm"
                                />
                              </div>

                              {/* Field Type */}
                              <div className="space-y-1.5">
                                <Label className="text-xs">Type</Label>
                                <Select
                                  value={field.type}
                                  onValueChange={(value: DataFieldType) =>
                                    updateDataField(field.id, { type: value })
                                  }
                                >
                                  <SelectTrigger className="h-8 text-sm">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {FIELD_TYPES.map((t) => (
                                      <SelectItem key={t.value} value={t.value}>
                                        {t.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            {/* Description */}
                            <div className="space-y-1.5">
                              <Label className="text-xs">
                                Description (for AI extraction)
                              </Label>
                              <Input
                                value={field.description}
                                onChange={(e) =>
                                  updateDataField(field.id, {
                                    description: e.target.value,
                                  })
                                }
                                placeholder="Describe what the AI should extract..."
                                className="h-8 text-sm"
                              />
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                              {/* Enum Values */}
                              <div className="space-y-1.5">
                                <Label className="text-xs">
                                  Allowed Values (comma-separated)
                                </Label>
                                <Input
                                  value={field.enumValues}
                                  onChange={(e) =>
                                    updateDataField(field.id, {
                                      enumValues: e.target.value,
                                    })
                                  }
                                  placeholder="value1, value2, value3"
                                  className="h-8 text-sm"
                                />
                              </div>

                              {/* Default Value */}
                              <div className="space-y-1.5">
                                <Label className="text-xs">Default Value</Label>
                                <Input
                                  value={field.defaultValue}
                                  onChange={(e) =>
                                    updateDataField(field.id, {
                                      defaultValue: e.target.value,
                                    })
                                  }
                                  placeholder="Default if not extracted"
                                  className="h-8 text-sm"
                                />
                              </div>
                            </div>

                            {/* Required Toggle */}
                            <div className="flex items-center justify-between pt-1">
                              <div className="space-y-0.5">
                                <Label
                                  htmlFor={`required-${field.id}`}
                                  className="text-xs"
                                >
                                  Required field
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                  AI will ask for this if not provided
                                </p>
                              </div>
                              <Switch
                                id={`required-${field.id}`}
                                checked={field.required}
                                onCheckedChange={(checked) =>
                                  updateDataField(field.id, { required: checked })
                                }
                              />
                            </div>
                          </div>
                        ))}
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addDataField}
                        className="w-full"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Another Field
                      </Button>
                    </>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        </div>

        {/* Preview Sidebar */}
        <div className="space-y-6">
          <ActionPreviewCard
            label={previewLabel}
            icon={previewIcon}
            buttonVariant="default"
          />

          {/* SDK Implementation Hint */}
          <Card>
            <CardHeader>
              <CardTitle>SDK Implementation</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="rounded bg-muted p-3 text-xs overflow-x-auto">
                {`pillar.onAction('${name || "action_name"}', (data) => {
  // Your handler code
});`}
              </pre>
            </CardContent>
          </Card>

          {/* Stats (for existing actions) */}
          {!isNew && initialData?.execution_count !== undefined && (
            <Card>
              <CardHeader>
                <CardTitle>Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Executions</dt>
                    <dd className="font-medium">
                      {initialData.execution_count}
                    </dd>
                  </div>
                  {initialData.last_executed_at && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Last executed</dt>
                      <dd className="font-medium">
                        {new Date(
                          initialData.last_executed_at
                        ).toLocaleDateString()}
                      </dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Has embedding</dt>
                    <dd className="font-medium">
                      {initialData.has_embedding ? "✓ Yes" : "✗ No"}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Actions */}
      {initialData?.source !== 'code' && (
        <div className="flex items-center justify-between border-t pt-6">
          {onDelete && !isNew ? (
            <Button type="button" variant="destructive" onClick={onDelete}>
              <Trash className="mr-2 h-4 w-4" />
              Delete Action
            </Button>
          ) : (
            <div />
          )}
          <Button
            type="submit"
            disabled={isLoading || !name || description.length < 10}
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {submitLabel}
          </Button>
        </div>
      )}
    </form>
  );
}
