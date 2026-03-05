'use client';

import { format } from 'date-fns';
import {
  AlertCircle,
  Bot,
  Brain,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
  MessageSquare,
  Plus,
  Search,
  ThumbsDown,
  ThumbsUp,
  User,
  Wand2,
  X,
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { useState, useRef, useEffect, useCallback } from 'react';
import { marked } from 'marked';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { createPortal } from 'react-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { conversationDetailQuery } from '@/queries/analytics.queries';
import {
  createCorrectionMutation,
  correctionsKeys,
} from '@/queries/corrections.queries';
import type { 
  ChatMessage, 
  ChunkDetail, 
  MessageFeedback, 
  CreateCorrectionResponse,
  ReasoningStep,
} from '@/types/admin';
import { cn } from '@/lib/utils';

import './ConversationDetailDrawer.css';
// Configure marked for GFM
marked.setOptions({
  gfm: true,
  breaks: true,
});

// ============================================================================
// Types
// ============================================================================

interface ConversationDetailDrawerProps {
  conversationId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCorrectionCreated?: () => void;
  onVisitorClick?: (visitorId: string) => void;
}

/** A quote selected from the conversation or reasoning timeline */
interface SelectedQuote {
  id: string;
  text: string;
  source: 'message' | 'reasoning';
  messageId: string;
  stepIndex?: number;
  stepType?: string;
  timestamp?: string;
}

/** Position for the text selection popover */
interface PopoverPosition {
  x: number;
  y: number;
  text: string;
  source: 'message' | 'reasoning';
  messageId: string;
  stepIndex?: number;
  stepType?: string;
}

// ============================================================================
// Chat Message Components
// ============================================================================

interface AssistantContentProps {
  content: string;
  latencyMs?: number | null;
  modelUsed?: string;
}

function AssistantContent({ content, latencyMs, modelUsed }: AssistantContentProps) {
  if (!content) {
    // Show a more informative indicator for action-only responses
    const latencyText = latencyMs ? `${(latencyMs / 1000).toFixed(1)}s` : '';
    
    return (
      <div className="conversation-action-indicator">
        <div className="conversation-action-icon">
          <CheckCircle className="h-4 w-4" />
        </div>
        <div className="flex flex-col">
          <span className="text-muted-foreground text-sm">Action executed (no text response)</span>
          {latencyText && (
            <span className="text-muted-foreground text-xs">Processed in {latencyText}</span>
          )}
        </div>
      </div>
    );
  }

  const html = marked.parse(content) as string;

  return (
    <div
      className="conversation-assistant-content"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

interface FeedbackIndicatorProps {
  feedback: MessageFeedback;
}

function FeedbackIndicator({ feedback }: FeedbackIndicatorProps) {
  if (feedback === 'up') {
    return (
      <div className="conversation-feedback conversation-feedback--positive" title="User marked as helpful">
        <ThumbsUp className="h-3.5 w-3.5" />
      </div>
    );
  }
  if (feedback === 'down') {
    return (
      <div className="conversation-feedback conversation-feedback--negative" title="User marked as not helpful">
        <ThumbsDown className="h-3.5 w-3.5" />
      </div>
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
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="conversation-sources">
      <CollapsibleTrigger asChild>
        <button className="conversation-sources-trigger">
          {isOpen ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
          <FileText className="h-3 w-3" />
          {chunks.length} source{chunks.length !== 1 ? 's' : ''} used
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="conversation-sources-content">
        {chunks.map((chunk, index) => (
          <div key={chunk.chunk_id || index} className="conversation-source-item">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                {chunk.source_title && (
                  <p className="font-medium text-foreground truncate text-xs">
                    {chunk.source_title}
                  </p>
                )}
                {chunk.title && chunk.title !== chunk.source_title && (
                  <p className="text-muted-foreground truncate text-xs">{chunk.title}</p>
                )}
              </div>
              <Badge variant="secondary" className="text-[10px] shrink-0">
                {(chunk.score * 100).toFixed(0)}%
              </Badge>
            </div>
            {chunk.content_preview && (
              <p className="mt-1 text-muted-foreground text-xs line-clamp-2">
                {chunk.content_preview}
              </p>
            )}
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

// ============================================================================
// Text Selection Popover
// ============================================================================

interface TextSelectionPopoverProps {
  position: PopoverPosition | null;
  onAddQuote: (quote: SelectedQuote) => void;
  onClose: () => void;
}

function TextSelectionPopover({ position, onAddQuote, onClose }: TextSelectionPopoverProps) {
  if (!position) return null;

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const quote: SelectedQuote = {
      id: `quote-${Date.now()}`,
      text: position.text,
      source: position.source,
      messageId: position.messageId,
      stepIndex: position.stepIndex,
      stepType: position.stepType,
    };
    onAddQuote(quote);
    onClose();
  };

  // Prevent mousedown from triggering the click-outside handler
  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return createPortal(
    <div
      className="text-selection-popover"
      style={{
        left: position.x,
        top: position.y,
      }}
      onMouseDown={handleMouseDown}
      onClick={(e) => e.stopPropagation()}
    >
      <button onClick={handleAdd} onMouseDown={handleMouseDown}>
        <Plus className="h-3 w-3" />
        Add to correction
      </button>
    </div>,
    document.body
  );
}

// ============================================================================
// Action Search Step Content (Collapsible)
// ============================================================================

interface ActionSearchStepContentProps {
  step: ReasoningStep;
}

function ActionSearchStepContent({ step }: ActionSearchStepContentProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const candidates = step.action_candidates || [];
  const hasMultipleCandidates = candidates.length > 1;
  const topCandidate = candidates[0];
  const otherCandidates = candidates.slice(1);

  // Fallback for old data without action_candidates
  if (candidates.length === 0) {
    return (
      <>
        <span>Found {step.actions_found || 0} actions</span>
        {step.top_action && (
          <div className="timeline-action-candidate">
            <Badge variant="outline" className="text-[10px] h-4">
              {step.top_action}
            </Badge>
            {step.top_score !== undefined && (
              <span className="text-muted-foreground text-[10px]">
                {(step.top_score * 100).toFixed(0)}%
              </span>
            )}
          </div>
        )}
      </>
    );
  }

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <div className="timeline-action-search-header">
        <span>Found {step.actions_found || 0} actions</span>
        {step.rerank_enabled && (
          <span className="timeline-rerank-badge" title={
            step.rerank_changed_top 
              ? `Reranking changed top from ${step.embedding_top_action}` 
              : 'Reranking confirmed top result'
          }>
            {step.rerank_changed_top ? '↻' : '✓'}
          </span>
        )}
        {hasMultipleCandidates && (
          <CollapsibleTrigger asChild>
            <button 
              className="timeline-action-expand-btn"
              onClick={(e) => e.stopPropagation()}
            >
              {isExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </button>
          </CollapsibleTrigger>
        )}
      </div>
      
      {/* Always show top candidate */}
      {topCandidate && (
        <div className="timeline-action-candidate timeline-action-candidate--top">
          <Badge variant="default" className="text-[10px] h-4">
            {topCandidate.name}
          </Badge>
          <span className="text-muted-foreground text-[10px]">
            {(topCandidate.score * 100).toFixed(0)}%
          </span>
        </div>
      )}
      
      {/* Rerank metadata in expanded view */}
      {hasMultipleCandidates && (
        <CollapsibleContent className="timeline-action-candidates-expanded">
          {step.rerank_enabled && step.rerank_time_ms !== undefined && (
            <div className="timeline-rerank-info">
              Reranked in {step.rerank_time_ms}ms
              {step.rerank_changed_top && step.embedding_top_action && (
                <> · was {step.embedding_top_action}</>
              )}
            </div>
          )}
          {otherCandidates.map((candidate) => (
            <div key={candidate.name} className="timeline-action-candidate">
              <Badge variant="outline" className="text-[10px] h-4">
                {candidate.name}
              </Badge>
              <span className="text-muted-foreground text-[10px]">
                {(candidate.score * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}

// ============================================================================
// Reasoning Timeline Panel (Middle Column)
// ============================================================================

interface TimelineEntry {
  type: 'user' | 'reasoning';
  messageId: string;
  content?: string;
  timestamp?: string;
  step?: ReasoningStep;
  stepIndex?: number;
}

interface ReasoningTimelinePanelProps {
  messages: ChatMessage[];
  highlightedMessageId: string | null;
  onMessageClick: (messageId: string) => void;
  onStepClick: (messageId: string, stepIndex: number, step: ReasoningStep) => void;
  onTextSelect: (position: PopoverPosition) => void;
}

function ReasoningTimelinePanel({
  messages,
  highlightedMessageId,
  onMessageClick,
  onStepClick,
  onTextSelect,
}: ReasoningTimelinePanelProps) {
  // Build a flat timeline with user messages as dividers
  const timeline: TimelineEntry[] = [];
  
  for (const message of messages) {
    if (message.role === 'user') {
      timeline.push({
        type: 'user',
        messageId: message.id,
        content: message.content,
        timestamp: message.timestamp,
      });
    } else if (message.role === 'assistant') {
      const trace = message.reasoning_trace || [];
      if (trace.length > 0) {
        trace.forEach((step, index) => {
          timeline.push({
            type: 'reasoning',
            messageId: message.id,
            step,
            stepIndex: index,
          });
        });
      } else {
        // No reasoning trace - show a placeholder
        timeline.push({
          type: 'reasoning',
          messageId: message.id,
          step: {
            step_type: 'answer',
            iteration: 0,
            timestamp_ms: 0,
            sources_used_count: message.chunks_details?.length || 0,
          },
          stepIndex: 0,
        });
      }
    }
  }

  const handleMouseUp = (
    e: React.MouseEvent,
    source: 'message' | 'reasoning',
    messageId: string,
    stepIndex?: number,
    stepType?: string
  ) => {
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    
    if (text && text.length > 5) {
      const rect = selection?.getRangeAt(0).getBoundingClientRect();
      if (rect) {
        onTextSelect({
          x: rect.left + rect.width / 2 - 60,
          y: rect.bottom + 8,
          text,
          source,
          messageId,
          stepIndex,
          stepType,
        });
      }
    }
  };

  if (timeline.length === 0) {
    return (
      <div className="timeline-empty">
        <Brain className="h-8 w-8 mx-auto timeline-empty-icon" />
        <p>No reasoning data available</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {timeline.map((entry, idx) => {
        if (entry.type === 'user') {
          return (
            <div
              key={`user-${entry.messageId}-${idx}`}
              className="timeline-user-divider"
              onMouseUp={(e) => handleMouseUp(e, 'message', entry.messageId)}
            >
              <div className="timeline-user-divider-icon">
                <User className="h-2.5 w-2.5" />
              </div>
              <span className="timeline-user-divider-text">
                {entry.content?.slice(0, 80)}{(entry.content?.length || 0) > 80 ? '...' : ''}
              </span>
            </div>
          );
        }

        // Reasoning step
        const step = entry.step!;
        const isHighlighted = entry.messageId === highlightedMessageId;
        
        return (
          <div
            key={`step-${entry.messageId}-${entry.stepIndex}-${idx}`}
            className={cn(
              'timeline-step',
              `timeline-step--${step.step_type}`,
              isHighlighted && 'timeline-step--highlighted'
            )}
            onClick={() => {
              // Don't trigger click if user was selecting text
              const selection = window.getSelection();
              const selectedText = selection?.toString().trim();
              if (selectedText && selectedText.length > 0) {
                return; // User was selecting text, don't handle as a click
              }
              onMessageClick(entry.messageId);
              if (entry.stepIndex !== undefined) {
                onStepClick(entry.messageId, entry.stepIndex, step);
              }
            }}
            onMouseUp={(e) => {
              e.stopPropagation();
              handleMouseUp(e, 'reasoning', entry.messageId, entry.stepIndex, step.step_type);
            }}
          >
            <div className="timeline-step-header">
              <span className="timeline-step-type">{step.step_type}</span>
              {step.timestamp_ms > 0 && (
                <span className="timeline-step-time">{step.timestamp_ms}ms</span>
              )}
            </div>
            <div className="timeline-step-content">
              {step.step_type === 'action_search' && (
                <ActionSearchStepContent step={step} />
              )}
              {step.step_type === 'decision' && (
                <>
                  <div className="timeline-decision-header">
                    <Badge variant="outline" className="text-[10px] h-4">
                      {step.decision}
                    </Badge>
                    {step.action_name && (
                      <Badge variant="secondary" className="text-[10px] h-4">
                        {step.action_name}
                      </Badge>
                    )}
                  </div>
                  {step.thought && (
                    <span className="timeline-decision-thought">{step.thought}</span>
                  )}
                </>
              )}
              {step.step_type === 'search' && (
                <code>{step.search_query}</code>
              )}
              {step.step_type === 'source_eval' && (
                <span>{step.sources_evaluated?.length || 0} sources evaluated</span>
              )}
              {step.step_type === 'answer' && (
                <span>Generated answer using {step.sources_used_count || 0} sources</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Chat Message Item (Simplified - no correction button, no collapsible reasoning)
// ============================================================================

interface ChatMessageItemProps {
  message: ChatMessage;
  isHighlighted?: boolean;
  onClick?: () => void;
  onTextSelect?: (position: PopoverPosition) => void;
}

function ChatMessageItem({ 
  message, 
  isHighlighted,
  onClick,
  onTextSelect,
}: ChatMessageItemProps) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!onTextSelect) return;
    
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    
    if (text && text.length > 5) {
      const rect = selection?.getRangeAt(0).getBoundingClientRect();
      if (rect) {
        onTextSelect({
          x: rect.left + rect.width / 2 - 60,
          y: rect.bottom + 8,
          text,
          source: 'message',
          messageId: message.id,
        });
      }
    }
  };

  return (
    <div
      className={cn(
        'conversation-message',
        isUser && 'conversation-message--user',
        isAssistant && 'conversation-message--assistant',
        isHighlighted && 'conversation-message--highlighted'
      )}
      onClick={onClick}
      onMouseUp={handleMouseUp}
    >
      {/* Avatar */}
      <div className={cn(
        'conversation-message-avatar',
        isUser && 'conversation-message-avatar--user'
      )}>
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      {/* Content */}
      <div className="conversation-message-content">
        {/* Timestamp and metadata header */}
        <div className="conversation-message-header">
          <span className="conversation-message-time">
            {format(new Date(message.timestamp), 'h:mm a')}
          </span>
          {isUser && message.query_type && (
            <Badge variant="outline" className="text-[10px] h-4">
              {message.query_type}
            </Badge>
          )}
          {isAssistant && message.latency_ms && (
            <span className="text-muted-foreground text-xs">
              {(message.latency_ms / 1000).toFixed(1)}s
            </span>
          )}
          {isAssistant && message.was_stopped && (
            <Badge variant="outline" className="text-[10px] h-4 text-orange-600 border-orange-200">
              Stopped
            </Badge>
          )}
        </div>

        {/* Message bubble/content */}
        {isUser ? (
          <div className="conversation-user-bubble">
            {message.content}
          </div>
        ) : (
          <div className="conversation-assistant-wrapper">
            <AssistantContent 
              content={message.content} 
              latencyMs={message.latency_ms}
              modelUsed={message.model_used}
            />
            
            {/* Feedback indicator */}
            <FeedbackIndicator feedback={message.feedback} />
          </div>
        )}

        {/* Assistant extras: sources only (reasoning is in middle panel now) */}
        {isAssistant && (
          <div className="conversation-message-extras">
            <SourcesList chunks={message.chunks_details || []} />
            
            {/* Feedback comment */}
            {message.feedback_comment && (
              <div className="conversation-feedback-comment">
                <p className="font-medium text-xs">User feedback:</p>
                <p className="text-xs">{message.feedback_comment}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Correction Panel (Right Column - 50%)
// ============================================================================

interface CorrectionPanelProps {
  quotes: SelectedQuote[];
  onRemoveQuote: (id: string) => void;
  conversationId: string;
  messages: ChatMessage[];
  onSuccess: () => void;
  onClear: () => void;
}

function CorrectionPanel({ 
  quotes,
  onRemoveQuote,
  conversationId, 
  messages,
  onSuccess, 
  onClear 
}: CorrectionPanelProps) {
  const queryClient = useQueryClient();
  const [correctionNotes, setCorrectionNotes] = useState('');
  const [result, setResult] = useState<CreateCorrectionResponse | null>(null);

  // Find the first assistant message from quotes, or use the last one
  const getTargetMessageId = (): string | null => {
    // If we have quotes from reasoning, use that message
    const reasoningQuote = quotes.find(q => q.source === 'reasoning');
    if (reasoningQuote) return reasoningQuote.messageId;
    
    // If we have a message quote, use that
    const messageQuote = quotes.find(q => q.source === 'message');
    if (messageQuote) return messageQuote.messageId;
    
    // Default to last assistant message
    const lastAssistant = messages.filter(m => m.role === 'assistant').pop();
    return lastAssistant?.id || null;
  };

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
        onSuccess();
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to create correction: ${error.message}`);
    },
  });

  const handleSubmit = () => {
    const messageId = getTargetMessageId();
    if (!messageId) {
      toast.error('No message selected for correction');
      return;
    }
    if (!correctionNotes.trim() || correctionNotes.length < 10) {
      toast.error('Please provide at least 10 characters describing what should happen instead');
      return;
    }

    // Build context from quotes
    const contextQuotes = quotes.map(q => ({
      text: q.text,
      source: q.source,
      step_index: q.stepIndex,
      step_type: q.stepType,
    }));

    createMutation.mutate({
      message_id: messageId,
      correction_notes: correctionNotes.trim(),
      context_quotes: contextQuotes,
    });
  };

  const handleReset = () => {
    setCorrectionNotes('');
    setResult(null);
    onClear();
  };

  const isSubmitting = createMutation.isPending;
  const isValid = correctionNotes.trim().length >= 10;
  const showResult = !!result && !result.error;

  if (showResult) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 text-green-600 mb-4">
          <CheckCircle className="h-5 w-5" />
          <h3 className="font-semibold text-base">Correction Created</h3>
        </div>

        <div className="rounded-md border bg-green-50 border-green-200 p-4 mb-4">
          <p className="text-sm text-green-700">
            A knowledge snippet has been created and is being indexed.
          </p>
        </div>
        
        <div className="space-y-2 flex-1 min-h-0">
          <Label className="text-xs text-muted-foreground">Generated Snippet</Label>
          <ScrollArea className="flex-1">
            <div className="rounded-md border p-3 space-y-2 bg-muted/30">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm">{result.processed_title}</h4>
                <Badge variant="secondary" className="text-[10px]">Processing</Badge>
              </div>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {result.processed_content}
              </p>
            </div>
          </ScrollArea>
        </div>

        <Button onClick={handleReset} className="w-full mt-4">
          Create Another Correction
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Wand2 className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-base">Create Correction</h3>
        </div>
        {(quotes.length > 0 || correctionNotes) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            disabled={isSubmitting}
            className="text-xs h-7"
          >
            Clear all
          </Button>
        )}
      </div>

      {/* Context Quotes */}
      <div className="space-y-2 mb-4">
        <Label className="text-xs text-muted-foreground">
          Context {quotes.length > 0 && `(${quotes.length})`}
        </Label>
        
        {quotes.length === 0 ? (
          <div className="correction-empty-context">
            <p>Select text from the chat or reasoning timeline to add context</p>
          </div>
        ) : (
          <div className="correction-quotes-container">
            {quotes.map((quote) => (
              <div 
                key={quote.id} 
                className={cn(
                  'correction-quote-card',
                  quote.source === 'reasoning' && 'correction-quote-card--reasoning'
                )}
              >
                <p className="correction-quote-text">&ldquo;{quote.text}&rdquo;</p>
                <p className="correction-quote-source">
                  {quote.source === 'reasoning' 
                    ? `Reasoning: ${quote.stepType || 'step'}`
                    : 'From conversation'
                  }
                </p>
                <button
                  className="correction-quote-remove"
                  onClick={() => onRemoveQuote(quote.id)}
                  disabled={isSubmitting}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Main Input - takes most of the space */}
      <div className="flex-1 flex flex-col min-h-0 space-y-2">
        <Label htmlFor="correction-notes" className="text-sm font-medium">
          What should happen instead?
        </Label>
        <Textarea
          id="correction-notes"
          value={correctionNotes}
          onChange={(e) => setCorrectionNotes(e.target.value)}
          placeholder="Describe what the correct response, reasoning, or behavior should be..."
          disabled={isSubmitting}
          className={cn(
            'flex-1 min-h-[200px] text-sm resize-none',
            !isValid && correctionNotes.length > 0 && 'border-orange-300'
          )}
        />
        {correctionNotes.length > 0 && correctionNotes.length < 10 && (
          <p className="text-xs text-orange-500">
            {10 - correctionNotes.length} more characters needed
          </p>
        )}
      </div>

      {/* Submit Button */}
      <Button
        onClick={handleSubmit}
        disabled={!isValid || isSubmitting}
        className="w-full mt-4"
        size="lg"
      >
        {isSubmitting ? (
          <>
            <Spinner size="sm" className="mr-2" />
            Creating correction...
          </>
        ) : (
          <>
            <Wand2 className="mr-2 h-4 w-4" />
            Create Correction
          </>
        )}
      </Button>
    </div>
  );
}

// ============================================================================
// Main Drawer Component
// ============================================================================

export function ConversationDetailDrawer({
  conversationId,
  open,
  onOpenChange,
  onCorrectionCreated,
  onVisitorClick,
}: ConversationDetailDrawerProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // State for highlighting/syncing between panels
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  
  // State for selected quotes (context for correction)
  const [selectedQuotes, setSelectedQuotes] = useState<SelectedQuote[]>([]);
  
  // State for text selection popover
  const [popoverPosition, setPopoverPosition] = useState<PopoverPosition | null>(null);

  const { data: conversation, isPending, isError } = useQuery({
    ...conversationDetailQuery(conversationId || ''),
    enabled: !!conversationId && open,
  });

  // Scroll to bottom on load
  useEffect(() => {
    if (conversation?.messages && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [conversation?.messages]);

  // Reset state when drawer closes
  useEffect(() => {
    if (!open) {
      setHighlightedMessageId(null);
      setSelectedQuotes([]);
      setPopoverPosition(null);
    }
  }, [open]);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // Check if click was inside the popover
      const target = e.target as HTMLElement;
      if (target.closest('.text-selection-popover')) {
        // Click was inside popover, don't close
        return;
      }
      setPopoverPosition(null);
    };
    
    if (popoverPosition) {
      // Delay to allow the popover to render
      const timer = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 50);
      
      return () => {
        clearTimeout(timer);
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [popoverPosition]);

  // Handle message click - sync highlight to reasoning panel
  const handleMessageClick = useCallback((messageId: string) => {
    setHighlightedMessageId(prev => prev === messageId ? null : messageId);
  }, []);

  // Handle reasoning step click - sync highlight to chat panel
  const handleStepClick = useCallback((messageId: string, stepIndex: number, step: ReasoningStep) => {
    setHighlightedMessageId(messageId);
    
    // Optionally auto-add as a quote
    // For now, we just highlight - text selection adds quotes
  }, []);

  // Handle adding a quote from text selection
  const handleAddQuote = useCallback((quote: SelectedQuote) => {
    setSelectedQuotes(prev => {
      // Prevent duplicates
      if (prev.some(q => q.text === quote.text && q.messageId === quote.messageId)) {
        return prev;
      }
      return [...prev, quote];
    });
  }, []);

  // Handle removing a quote
  const handleRemoveQuote = useCallback((id: string) => {
    setSelectedQuotes(prev => prev.filter(q => q.id !== id));
  }, []);

  // Handle text selection (shows popover)
  const handleTextSelect = useCallback((position: PopoverPosition) => {
    setPopoverPosition(position);
  }, []);

  // Handle correction success
  const handleCorrectionSuccess = useCallback(() => {
    setHighlightedMessageId(null);
    setSelectedQuotes([]);
    onCorrectionCreated?.();
  }, [onCorrectionCreated]);

  // Handle clear all
  const handleClearAll = useCallback(() => {
    setHighlightedMessageId(null);
    setSelectedQuotes([]);
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="conversation-drawer-content h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-3 border-b shrink-0">
          <div className="flex items-center justify-between pr-8">
            <div className="flex items-center gap-3">
              <DialogTitle className="text-lg">Conversation Details</DialogTitle>
              {conversation && (
                <Badge variant={conversation.status === 'escalated' ? 'destructive' : 'secondary'}>
                  {conversation.status}
                </Badge>
              )}
            </div>
            {conversation && (
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>{conversation.message_count} messages</span>
                {conversation.visitor && (
                  <button
                    onClick={() => onVisitorClick?.(conversation.visitor!.id)}
                    className="flex items-center gap-1.5 hover:text-foreground transition-colors"
                  >
                    <User className="h-3.5 w-3.5" />
                    <span className="underline underline-offset-2">
                      {conversation.visitor.name || conversation.visitor.email || 'Unknown User'}
                    </span>
                  </button>
                )}
                {conversation.has_negative_feedback && (
                  <span className="flex items-center gap-1 text-orange-600">
                    <ThumbsDown className="h-3.5 w-3.5" />
                    Negative feedback
                  </span>
                )}
              </div>
            )}
          </div>
          {conversation && (
            <DialogDescription>
              {format(new Date(conversation.started_at), 'MMMM d, yyyy at h:mm a')}
              {conversation.page_url && (
                <>
                  {' · '}
                  <a
                    href={conversation.page_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    {(() => {
                      try {
                        return new URL(conversation.page_url).pathname;
                      } catch {
                        return 'View page';
                      }
                    })()}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </>
              )}
            </DialogDescription>
          )}
        </DialogHeader>

        {/* Content - Three Panel Layout */}
        <div className="flex-1 min-h-0">
          {isPending && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-3">
                <Spinner size="lg" className="mx-auto" />
                <p className="text-muted-foreground">Loading conversation...</p>
              </div>
            </div>
          )}

          {isError && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-3">
                <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto" />
                <p className="text-muted-foreground">Failed to load conversation</p>
              </div>
            </div>
          )}

          {conversation && (
            <div className="conversation-drawer-layout">
              {/* Left Panel: Chat Messages (25%) */}
              <div className="conversation-chat-panel">
                <ScrollArea className="h-full">
                  <div className="conversation-messages-container">
                    {conversation.messages.map((message) => (
                      <ChatMessageItem
                        key={message.id}
                        message={message}
                        isHighlighted={highlightedMessageId === message.id}
                        onClick={message.role === 'assistant' ? () => handleMessageClick(message.id) : undefined}
                        onTextSelect={handleTextSelect}
                      />
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>
              </div>

              {/* Middle Panel: Reasoning Timeline (25%) */}
              <div className="conversation-reasoning-panel">
                <div className="conversation-reasoning-panel-header">
                  <Brain className="h-4 w-4" />
                  Reasoning Timeline
                </div>
                <ScrollArea className="h-[calc(100%-2.5rem)]">
                  <div className="conversation-reasoning-panel-content">
                    <ReasoningTimelinePanel
                      messages={conversation.messages}
                      highlightedMessageId={highlightedMessageId}
                      onMessageClick={handleMessageClick}
                      onStepClick={handleStepClick}
                      onTextSelect={handleTextSelect}
                    />
                  </div>
                </ScrollArea>
              </div>

              {/* Right Panel: Correction Form (50%) */}
              <div className="conversation-correction-panel">
                <div className="conversation-correction-panel-content">
                  {/* Escalation Warning (only if escalated) */}
                  {conversation.status === 'escalated' && conversation.escalation_reason && (
                    <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 shrink-0">
                      <p className="font-medium">Escalation Reason</p>
                      <p className="text-xs mt-1">{conversation.escalation_reason}</p>
                    </div>
                  )}

                  {/* Correction Panel */}
                  <CorrectionPanel
                    quotes={selectedQuotes}
                    onRemoveQuote={handleRemoveQuote}
                    conversationId={conversationId || ''}
                    messages={conversation.messages}
                    onSuccess={handleCorrectionSuccess}
                    onClear={handleClearAll}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Text Selection Popover */}
        <TextSelectionPopover
          position={popoverPosition}
          onAddQuote={handleAddQuote}
          onClose={() => setPopoverPosition(null)}
        />
      </DialogContent>
    </Dialog>
  );
}
