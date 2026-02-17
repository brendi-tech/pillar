'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  Bot,
  CheckCircle,
  FileText,
  User,
  Wand2,
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import {
  createCorrectionMutation,
  correctionsKeys,
} from '@/queries/corrections.queries';
import type { ChatMessage, CreateCorrectionResponse } from '@/types/admin';
import { cn } from '@/lib/utils';

interface CreateCorrectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assistantMessage: ChatMessage;
  userMessage: ChatMessage | null;
  conversationId: string;
  onSuccess: () => void;
}

export function CreateCorrectionDialog({
  open,
  onOpenChange,
  assistantMessage,
  userMessage,
  onSuccess,
}: CreateCorrectionDialogProps) {
  const queryClient = useQueryClient();
  const [correctionNotes, setCorrectionNotes] = useState('');
  const [result, setResult] = useState<CreateCorrectionResponse | null>(null);

  const createMutation = useMutation({
    ...createCorrectionMutation(),
    onSuccess: (data) => {
      if (data.error) {
        toast.error(`Failed to process correction: ${data.error}`);
        setResult(data);
      } else {
        toast.success('Correction created successfully!');
        setResult(data);
        queryClient.invalidateQueries({ queryKey: correctionsKeys.all });
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to create correction: ${error.message}`);
    },
  });

  const handleSubmit = () => {
    if (!correctionNotes.trim() || correctionNotes.length < 10) {
      toast.error('Please provide at least 10 characters describing what went wrong');
      return;
    }

    createMutation.mutate({
      message_id: assistantMessage.id,
      correction_notes: correctionNotes.trim(),
    });
  };

  const handleClose = () => {
    if (!createMutation.isPending) {
      setCorrectionNotes('');
      setResult(null);
      onOpenChange(false);
      if (result?.knowledge_item_id) {
        onSuccess();
      }
    }
  };

  const isSubmitting = createMutation.isPending;
  const isValid = correctionNotes.trim().length >= 10;
  const showResult = !!result && !result.error;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            Create Correction
          </DialogTitle>
          <DialogDescription>
            Create a knowledge snippet to improve AI responses for similar questions
          </DialogDescription>
        </DialogHeader>

        {!showResult ? (
          <>
            {/* Context Section */}
            <div className="space-y-4 flex-1 min-h-0">
              {/* User's Question */}
              {userMessage && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-muted-foreground">
                    <User className="h-4 w-4" />
                    User's Question
                  </Label>
                  <div className="rounded-md border bg-muted/30 p-3 text-sm">
                    <p className="whitespace-pre-wrap">{userMessage.content}</p>
                  </div>
                </div>
              )}

              {/* AI's Response */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-muted-foreground">
                  <Bot className="h-4 w-4" />
                  AI's Response (to be corrected)
                </Label>
                <ScrollArea className="max-h-[150px]">
                  <div className="rounded-md border bg-muted/30 p-3 text-sm">
                    <p className="whitespace-pre-wrap">{assistantMessage.content}</p>
                  </div>
                </ScrollArea>
                {assistantMessage.chunks_details && assistantMessage.chunks_details.length > 0 && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <FileText className="h-3 w-3" />
                    <span>
                      Used {assistantMessage.chunks_details.length} source
                      {assistantMessage.chunks_details.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}
              </div>

              {/* Correction Notes */}
              <div className="space-y-2">
                <Label htmlFor="correction-notes" className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-orange-500" />
                  What went wrong and what's correct?
                </Label>
                <Textarea
                  id="correction-notes"
                  value={correctionNotes}
                  onChange={(e) => setCorrectionNotes(e.target.value)}
                  placeholder="Explain what the AI got wrong and provide the correct information. Be specific - this will be used to train the AI to give better responses."
                  rows={5}
                  disabled={isSubmitting}
                  className={cn(
                    !isValid && correctionNotes.length > 0 && 'border-orange-300'
                  )}
                />
                <p className="text-xs text-muted-foreground">
                  {correctionNotes.length < 10 && correctionNotes.length > 0 && (
                    <span className="text-orange-500">
                      Please provide at least 10 characters ({10 - correctionNotes.length} more needed)
                    </span>
                  )}
                  {correctionNotes.length >= 10 && (
                    <span className="text-green-600">
                      ✓ {correctionNotes.length} characters
                    </span>
                  )}
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!isValid || isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Spinner size="sm" className="mr-2" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Wand2 className="mr-2 h-4 w-4" />
                    Create Correction
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            {/* Success Result */}
            <div className="space-y-4 flex-1 min-h-0">
              <div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 border border-green-200">
                <CheckCircle className="h-8 w-8 text-green-600 shrink-0" />
                <div>
                  <p className="font-medium text-green-800">
                    Correction Created Successfully
                  </p>
                  <p className="text-sm text-green-600">
                    A knowledge snippet has been created and is being indexed
                  </p>
                </div>
              </div>

              {/* Generated Content Preview */}
              <div className="space-y-2">
                <Label className="text-muted-foreground">Generated Snippet</Label>
                <div className="rounded-md border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">{result.processed_title}</h4>
                    <Badge variant="secondary">Processing</Badge>
                  </div>
                  <ScrollArea className="max-h-[200px]">
                    <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {result.processed_content}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={handleClose}>
                Done
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
