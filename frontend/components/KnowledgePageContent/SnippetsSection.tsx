'use client';

import { EmptyState } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  deleteSnippetMutation,
  updateSnippetMutation,
  knowledgeKeys,
} from '@/queries/knowledge.queries';
import type { KnowledgeItem } from '@/types/knowledge';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { Edit2, FileText, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { SnippetFormDialog } from './SnippetFormDialog';

interface SnippetsSectionProps {
  snippets: KnowledgeItem[];
  onRefetch: () => void;
}

export function SnippetsSection({ snippets, onRefetch }: SnippetsSectionProps) {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSnippet, setEditingSnippet] = useState<KnowledgeItem | null>(
    null
  );

  const deleteMutation = useMutation({
    ...deleteSnippetMutation(),
    onSuccess: () => {
      toast.success('Snippet deleted');
      queryClient.invalidateQueries({ queryKey: knowledgeKeys.snippets() });
      onRefetch();
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete snippet: ${error.message}`);
    },
  });

  const toggleActiveMutation = useMutation({
    ...updateSnippetMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: knowledgeKeys.snippets() });
      onRefetch();
    },
    onError: (error: Error) => {
      toast.error(`Failed to update snippet: ${error.message}`);
    },
  });

  const handleEdit = (snippet: KnowledgeItem) => {
    setEditingSnippet(snippet);
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this snippet?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleToggleActive = (snippet: KnowledgeItem) => {
    toggleActiveMutation.mutate({
      id: snippet.id,
      data: { is_active: !snippet.is_active },
    });
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingSnippet(null);
  };

  const handleDialogSuccess = () => {
    handleDialogClose();
    onRefetch();
  };

  if (snippets.length === 0) {
    return (
      <>
        <EmptyState
          icon={FileText}
          title="No snippets yet"
          description="Add custom text snippets with specific instructions or context for your AI assistant."
          action={
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Snippet
            </Button>
          }
        />

        <SnippetFormDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          snippet={editingSnippet}
          onSuccess={handleDialogSuccess}
        />
      </>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Snippet
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {snippets.map((snippet) => (
          <Card key={snippet.id} className="group relative">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <CardTitle>{snippet.title}</CardTitle>
                    <CardDescription className="text-xs">
                      {formatDistanceToNow(new Date(snippet.created_at), {
                        addSuffix: true,
                      })}
                    </CardDescription>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleEdit(snippet)}>
                      <Edit2 className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleToggleActive(snippet)}>
                      {snippet.is_active ? 'Disable' : 'Enable'}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleDelete(snippet.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="line-clamp-3 text-sm text-muted-foreground">
                {snippet.raw_content}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <Badge variant={snippet.is_active ? 'default' : 'secondary'}>
                  {snippet.is_active ? 'Active' : 'Disabled'}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {snippet.chunk_count} chunks
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <SnippetFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        snippet={editingSnippet}
        onSuccess={handleDialogSuccess}
      />
    </div>
  );
}
