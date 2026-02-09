'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { actionSuggestionListQuery, actionSuggestionKeys, applyActionSuggestionMutation, dismissActionSuggestionMutation } from '@/queries/action-suggestions.queries';
import { actionKeys } from '@/queries/actions.queries';
import type { ActionSuggestion } from '@/types/actions';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { ActionSuggestionCard } from './ActionSuggestionCard';

interface ActionSuggestionsSectionProps {
  helpCenterConfigId?: string;
}

/**
 * Section displaying pending AI-generated action suggestions.
 */
export function ActionSuggestionsSection({ helpCenterConfigId }: ActionSuggestionsSectionProps) {
  const queryClient = useQueryClient();

  // Fetch pending suggestions
  const { data, isLoading, error } = useQuery(
    actionSuggestionListQuery({
      help_center_config: helpCenterConfigId,
      status: 'pending',
    })
  );

  const suggestions = data?.results ?? [];

  // Apply mutation
  const applyMutation = useMutation({
    ...applyActionSuggestionMutation(),
    onSuccess: (action) => {
      toast.success(`Action "${action.name}" created successfully`);
      // Invalidate both suggestions and actions lists
      queryClient.invalidateQueries({ queryKey: actionSuggestionKeys.lists() });
      queryClient.invalidateQueries({ queryKey: actionKeys.lists() });
    },
    onError: (error) => {
      toast.error(`Failed to create action: ${error.message}`);
    },
  });

  // Dismiss mutation
  const dismissMutation = useMutation({
    ...dismissActionSuggestionMutation(),
    onSuccess: () => {
      toast.success('Suggestion dismissed');
      queryClient.invalidateQueries({ queryKey: actionSuggestionKeys.lists() });
    },
    onError: (error) => {
      toast.error(`Failed to dismiss suggestion: ${error.message}`);
    },
  });

  const handleApply = (suggestion: ActionSuggestion) => {
    applyMutation.mutate({ suggestionId: suggestion.id });
  };

  const handleDismiss = (suggestion: ActionSuggestion) => {
    dismissMutation.mutate({ suggestionId: suggestion.id });
  };

  // Don't show section if no suggestions and not loading
  if (!isLoading && suggestions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">AI Action Suggestions</h2>
          {suggestions.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {suggestions.length} pending
            </Badge>
          )}
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-64 rounded-lg" />
          ))}
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          <AlertCircle className="h-5 w-5" />
          <span>Failed to load suggestions: {error.message}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: actionSuggestionKeys.lists() })}
            className="ml-auto"
          >
            Retry
          </Button>
        </div>
      )}

      {/* Suggestions Grid */}
      {!isLoading && !error && suggestions.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {suggestions.map((suggestion) => (
            <ActionSuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              onApply={handleApply}
              onDismiss={handleDismiss}
              isApplying={applyMutation.isPending && applyMutation.variables?.suggestionId === suggestion.id}
              isDismissing={dismissMutation.isPending && dismissMutation.variables?.suggestionId === suggestion.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
