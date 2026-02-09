'use client';

import { format } from 'date-fns';
import {
  AlertCircle,
  Bot,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
  Loader2,
  ThumbsDown,
  ThumbsUp,
  User,
  Wand2,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { usePillarContext } from '@pillar-ai/react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { conversationDetailQuery } from '@/queries/analytics.queries';
import type { ChatMessage, ChunkDetail, MessageFeedback } from '@/types/admin';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

import { CreateCorrectionDialog } from './CreateCorrectionDialog';

interface ConversationDetailModalProps {
  conversationId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCorrectionCreated?: () => void;
}

function FeedbackBadge({ feedback }: { feedback: MessageFeedback }) {
  if (feedback === 'up') {
    return (
      <Badge variant="outline" className="gap-1 text-green-600 border-green-200 bg-green-50">
        <ThumbsUp className="h-3 w-3" />
        Helpful
      </Badge>
    );
  }
  if (feedback === 'down') {
    return (
      <Badge variant="outline" className="gap-1 text-orange-600 border-orange-200 bg-orange-50">
        <ThumbsDown className="h-3 w-3" />
        Not Helpful
      </Badge>
    );
  }
  return null;
}

interface SourcesListProps {
  chunks: ChunkDetail[];
}

function SourcesList({ chunks }: SourcesListProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!chunks || chunks.length === 0) {
    return null;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground p-0 h-auto">
          {isOpen ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
          <FileText className="h-3 w-3" />
          {chunks.length} source{chunks.length !== 1 ? 's' : ''} used
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-2">
        {chunks.map((chunk, index) => (
          <div
            key={chunk.chunk_id || index}
            className="rounded-md border bg-muted/30 p-3 text-xs"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                {chunk.source_title && (
                  <p className="font-medium text-foreground truncate">
                    {chunk.source_title}
                  </p>
                )}
                {chunk.title && chunk.title !== chunk.source_title && (
                  <p className="text-muted-foreground truncate">{chunk.title}</p>
                )}
              </div>
              <Badge variant="secondary" className="text-[10px] shrink-0">
                {(chunk.score * 100).toFixed(0)}% match
              </Badge>
            </div>
            {chunk.content_preview && (
              <p className="mt-2 text-muted-foreground line-clamp-2">
                {chunk.content_preview}
              </p>
            )}
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

interface MessageBubbleProps {
  message: ChatMessage;
  onCreateCorrection?: () => void;
}

function MessageBubble({ message, onCreateCorrection }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const [isReasoningOpen, setIsReasoningOpen] = useState(false);

  return (
    <div
      className={cn(
        'flex gap-3',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-muted-foreground'
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      {/* Content */}
      <div
        className={cn(
          'flex max-w-[80%] flex-col gap-2',
          isUser ? 'items-end' : 'items-start'
        )}
      >
        {/* Timestamp and metadata */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{format(new Date(message.timestamp), 'h:mm a')}</span>
          {/* Query type badge for user messages */}
          {isUser && message.query_type && (
            <Badge variant="outline" className="text-[10px] h-4">
              {message.query_type}
            </Badge>
          )}
          {/* Intent badge for user messages */}
          {isUser && message.intent_category && (
            <Badge variant="secondary" className="text-[10px] h-4">
              {message.intent_category}
            </Badge>
          )}
          {/* Latency for assistant messages */}
          {isAssistant && message.latency_ms && (
            <span>{(message.latency_ms / 1000).toFixed(1)}s</span>
          )}
          {/* Stopped early indicator */}
          {isAssistant && message.was_stopped && (
            <Badge variant="outline" className="text-[10px] h-4 text-orange-600 border-orange-200">
              Stopped early
            </Badge>
          )}
        </div>

        {/* Message */}
        <div
          className={cn(
            'rounded-lg px-4 py-2.5',
            isUser
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-foreground'
          )}
        >
          <p className="whitespace-pre-wrap text-sm">{message.content}</p>
        </div>

        {/* Assistant-specific info */}
        {isAssistant && (
          <div className="flex flex-wrap items-center gap-2">
            {/* Feedback */}
            <FeedbackBadge feedback={message.feedback} />

            {/* Sources */}
            {message.chunks_details && message.chunks_details.length > 0 && (
              <SourcesList chunks={message.chunks_details} />
            )}

            {/* Reasoning trace toggle */}
            {message.reasoning_trace && message.reasoning_trace.length > 0 && (
              <Collapsible open={isReasoningOpen} onOpenChange={setIsReasoningOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-1 text-xs h-auto p-1">
                    {isReasoningOpen ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                    {message.reasoning_trace.length} reasoning step{message.reasoning_trace.length !== 1 ? 's' : ''}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-2">
                  {message.reasoning_trace.map((step, index) => (
                    <div key={index} className="rounded-md border bg-blue-50 dark:bg-blue-900/20 p-2 text-xs">
                      {step.thought && (
                        <p><span className="font-medium">Thought:</span> {step.thought}</p>
                      )}
                      {step.action && (
                        <p><span className="font-medium">Action:</span> {step.action}</p>
                      )}
                      {step.observation && (
                        <p className="text-muted-foreground"><span className="font-medium">Observation:</span> {step.observation}</p>
                      )}
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Create Correction Button */}
            {onCreateCorrection && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-xs h-auto p-1"
                onClick={onCreateCorrection}
              >
                <Wand2 className="h-3 w-3" />
                Create Correction
              </Button>
            )}
          </div>
        )}

        {/* Feedback comment if exists */}
        {isAssistant && message.feedback_comment && (
          <div className="rounded-md border border-orange-200 bg-orange-50 p-2 text-xs text-orange-700">
            <p className="font-medium">User feedback:</p>
            <p>{message.feedback_comment}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function ConversationDetailModal({
  conversationId,
  open,
  onOpenChange,
  onCorrectionCreated,
}: ConversationDetailModalProps) {
  const [correctionMessage, setCorrectionMessage] = useState<ChatMessage | null>(null);
  const [isCorrectionDialogOpen, setIsCorrectionDialogOpen] = useState(false);
  const { setTextSelectionEnabled } = usePillarContext();

  // Disable text selection "Ask AI" popover when modal is open
  useEffect(() => {
    if (open) {
      setTextSelectionEnabled(false);
      return () => setTextSelectionEnabled(true);
    }
  }, [open, setTextSelectionEnabled]);

  const { data: conversation, isPending, isError } = useQuery({
    ...conversationDetailQuery(conversationId || ''),
    enabled: !!conversationId && open,
  });

  const handleCreateCorrection = (message: ChatMessage) => {
    setCorrectionMessage(message);
    setIsCorrectionDialogOpen(true);
  };

  const handleCorrectionSuccess = () => {
    setIsCorrectionDialogOpen(false);
    setCorrectionMessage(null);
    onCorrectionCreated?.();
  };

  // Find the user message that preceded the assistant message for context
  const findPrecedingUserMessage = (assistantMessage: ChatMessage): ChatMessage | null => {
    if (!conversation?.messages) return null;
    const messageIndex = conversation.messages.findIndex(
      (m) => m.id === assistantMessage.id
    );
    if (messageIndex <= 0) return null;
    
    // Find the previous user message
    for (let i = messageIndex - 1; i >= 0; i--) {
      if (conversation.messages[i].role === 'user') {
        return conversation.messages[i];
      }
    }
    return null;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Conversation Details
              {conversation && (
                <Badge variant={conversation.status === 'escalated' ? 'destructive' : 'secondary'}>
                  {conversation.status}
                </Badge>
              )}
            </DialogTitle>
            {conversation && (
              <DialogDescription className="flex flex-col gap-1">
                <span>
                  Started {format(new Date(conversation.started_at), 'MMMM d, yyyy at h:mm a')}
                </span>
                {conversation.page_url && (
                  <a
                    href={conversation.page_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {new URL(conversation.page_url).pathname}
                  </a>
                )}
              </DialogDescription>
            )}
          </DialogHeader>

          {/* Content */}
          <div className="flex-1 min-h-0">
            {isPending && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}

            {isError && (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
                <AlertCircle className="h-8 w-8" />
                <p>Failed to load conversation</p>
              </div>
            )}

            {conversation && (
              <ScrollArea className="h-[500px] pr-4">
                <div className="space-y-6 py-4">
                  {conversation.messages.map((message) => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      onCreateCorrection={
                        message.role === 'assistant'
                          ? () => handleCreateCorrection(message)
                          : undefined
                      }
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Escalation info */}
          {conversation?.status === 'escalated' && conversation.escalation_reason && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <p className="font-medium">Escalation Reason:</p>
              <p>{conversation.escalation_reason}</p>
              {conversation.escalated_to && (
                <p className="mt-1 text-xs">
                  Escalated to: {conversation.escalated_to}
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Correction Dialog */}
      {correctionMessage && conversation && (
        <CreateCorrectionDialog
          open={isCorrectionDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              setIsCorrectionDialogOpen(false);
              setCorrectionMessage(null);
            }
          }}
          assistantMessage={correctionMessage}
          userMessage={findPrecedingUserMessage(correctionMessage)}
          conversationId={conversation.id}
          onSuccess={handleCorrectionSuccess}
        />
      )}
    </>
  );
}
