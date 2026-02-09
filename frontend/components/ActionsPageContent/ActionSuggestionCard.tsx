'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { ActionSuggestion } from '@/types/actions';
import { ACTION_TYPE_LABELS, deriveActionLabel } from '@/types/actions';
import { formatDistanceToNow } from 'date-fns';
import {
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
  Lightbulb,
  Sparkles,
  X,
} from 'lucide-react';
import { useState } from 'react';

interface ActionSuggestionCardProps {
  suggestion: ActionSuggestion;
  onApply: (suggestion: ActionSuggestion) => void;
  onDismiss: (suggestion: ActionSuggestion) => void;
  isApplying?: boolean;
  isDismissing?: boolean;
}

/**
 * Card displaying an AI-generated action suggestion for review.
 */
export function ActionSuggestionCard({
  suggestion,
  onApply,
  onDismiss,
  isApplying = false,
  isDismissing = false,
}: ActionSuggestionCardProps) {
  const [isReasoningOpen, setIsReasoningOpen] = useState(false);

  const { action_data } = suggestion;
  const confidence = suggestion.confidence;
  const actionType = action_data?.action_type;

  // Confidence color
  const confidenceColor =
    confidence >= 80
      ? 'text-green-600 bg-green-100 dark:bg-green-900/30'
      : confidence >= 60
        ? 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30'
        : 'text-red-600 bg-red-100 dark:bg-red-900/30';

  return (
    <Card className="relative border-2 border-dashed border-primary/30 bg-primary/5">
      {/* AI Badge */}
      <div className="absolute -top-3 left-4">
        <Badge variant="secondary" className="gap-1 bg-primary text-primary-foreground">
          <Sparkles className="h-3 w-3" />
          AI Suggestion
        </Badge>
      </div>

      <CardHeader className="pt-6">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-primary" />
              {action_data?.name ? deriveActionLabel(action_data.name) : 'Unknown Action'}
            </CardTitle>
            <CardDescription className="text-sm">
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                {action_data?.name ?? 'unknown'}
              </code>
            </CardDescription>
          </div>
          <Badge className={cn('shrink-0', confidenceColor)}>
            {confidence}% confidence
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Description */}
        {action_data?.description && (
          <p className="text-sm text-muted-foreground">{action_data.description}</p>
        )}

        {/* Action Type */}
        {actionType && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Type:</span>
            <Badge variant="outline" className="text-xs">
              {ACTION_TYPE_LABELS[actionType] ?? actionType}
            </Badge>
          </div>
        )}

        {/* Path Template (for navigate actions) */}
        {action_data?.path_template && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Path:</span>
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              {action_data.path_template}
            </code>
          </div>
        )}

        {/* Source Article */}
        {suggestion.source_article_title && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileText className="h-4 w-4" />
            <span>From:</span>
            {suggestion.source_article_id ? (
              <a
                href={`/articles/${suggestion.source_article_id}`}
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                {suggestion.source_article_title}
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <span>{suggestion.source_article_title}</span>
            )}
          </div>
        )}

        {/* AI Reasoning (Collapsible) */}
        {suggestion.reasoning && (
          <Collapsible open={isReasoningOpen} onOpenChange={setIsReasoningOpen}>
            <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              {isReasoningOpen ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              AI Reasoning
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                {suggestion.reasoning}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Created At */}
        <div className="text-xs text-muted-foreground">
          Suggested {formatDistanceToNow(new Date(suggestion.created_at), { addSuffix: true })}
        </div>
      </CardContent>

      <CardFooter className="flex justify-end gap-2 border-t bg-muted/30 pt-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDismiss(suggestion)}
          disabled={isDismissing || isApplying}
        >
          <X className="mr-1 h-4 w-4" />
          Dismiss
        </Button>
        <Button
          size="sm"
          onClick={() => onApply(suggestion)}
          disabled={isApplying || isDismissing}
        >
          <Check className="mr-1 h-4 w-4" />
          {isApplying ? 'Creating...' : 'Create Action'}
        </Button>
      </CardFooter>
    </Card>
  );
}
