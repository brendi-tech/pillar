'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  createSnippetMutation,
  updateSnippetMutation,
  knowledgeKeys,
} from '@/queries/knowledge.queries';
import type { KnowledgeItem } from '@/types/knowledge';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface SnippetFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  snippet: KnowledgeItem | null;
  onSuccess: () => void;
}

export function SnippetFormDialog({
  open,
  onOpenChange,
  snippet,
  onSuccess,
}: SnippetFormDialogProps) {
  const queryClient = useQueryClient();
  const isEditing = !!snippet;

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState(0);

  // Reset form when dialog opens/closes or snippet changes
  useEffect(() => {
    if (open) {
      if (snippet) {
        setTitle(snippet.title);
        setContent(snippet.raw_content);
        setPriority(snippet.metadata?.priority ?? 0);
      } else {
        setTitle('');
        setContent('');
        setPriority(0);
      }
    }
  }, [open, snippet]);

  const createMutation = useMutation({
    ...createSnippetMutation(),
    onSuccess: () => {
      toast.success('Snippet created!');
      queryClient.invalidateQueries({ queryKey: knowledgeKeys.snippets() });
      onSuccess();
    },
    onError: (error: Error) => {
      toast.error(`Failed to create snippet: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    ...updateSnippetMutation(),
    onSuccess: () => {
      toast.success('Snippet updated!');
      queryClient.invalidateQueries({ queryKey: knowledgeKeys.snippets() });
      onSuccess();
    },
    onError: (error: Error) => {
      toast.error(`Failed to update snippet: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isEditing && snippet) {
      updateMutation.mutate({
        id: snippet.id,
        data: {
          title,
          content,
          metadata: priority > 0 ? { priority } : undefined,
        },
      });
    } else {
      createMutation.mutate({
        title,
        content,
        metadata: priority > 0 ? { priority } : undefined,
      });
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const isValid = title.trim() !== '' && content.trim() !== '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEditing ? 'Edit Snippet' : 'Add Snippet'}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? 'Update your snippet content.'
                : 'Create a new snippet with custom instructions or context for your AI.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Refund Policy"
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Content</Label>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Enter the content or instructions for your AI assistant..."
                rows={8}
                disabled={isSubmitting}
              />
              <p className="text-xs text-muted-foreground">
                This content will be indexed and used by the AI when answering
                questions.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority (optional)</Label>
              <Input
                id="priority"
                type="number"
                min={0}
                max={100}
                value={priority}
                onChange={(e) => setPriority(parseInt(e.target.value) || 0)}
                placeholder="0"
                disabled={isSubmitting}
              />
              <p className="text-xs text-muted-foreground">
                Higher priority snippets (1-100) are weighted more in search
                results. Leave at 0 for normal priority.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!isValid || isSubmitting}>
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {isEditing ? 'Save Changes' : 'Create Snippet'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
