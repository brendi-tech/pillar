'use client';

import { format, formatDistanceToNow } from 'date-fns';
import {
  AlertCircle,
  Bot,
  Brain,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  FileText,
  Globe,
  Languages,
  MessageSquare,
  Plus,
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
import { createPortal } from 'react-dom';
import { toast } from 'sonner';

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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Textarea } from '@/components/ui/textarea';
import { conversationDetailQuery } from '@/queries/analytics.queries';
import {
  createCorrectionMutation,
  correctionsKeys,
} from '@/queries/corrections.queries';
import type {
  ChatMessage,
  ChunkDetail,
  MessageFeedback,
  ReasoningStep,
  ActionCandidate,
  CreateCorrectionResponse,
} from '@/types/admin';
import { cn } from '@/lib/utils';

import './ConversationDetailDrawer.css';
import { useConversationTranslation } from './useConversationTranslation';

marked.setOptions({ gfm: true, breaks: true });

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

interface SelectedQuote {
  id: string;
  text: string;
  source: 'message' | 'reasoning';
  messageId: string;
  stepIndex?: number;
  stepType?: string;
}

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
// Shared Sub-components
// ============================================================================

function FeedbackIndicator({ feedback }: { feedback: MessageFeedback }) {
  if (feedback === 'up') {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <ThumbsUp className="h-3 w-3" />
          </div>
        </TooltipTrigger>
        <TooltipContent>User marked as helpful</TooltipContent>
      </Tooltip>
    );
  }
  if (feedback === 'down') {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <ThumbsDown className="h-3 w-3" />
          </div>
        </TooltipTrigger>
        <TooltipContent>User marked as not helpful</TooltipContent>
      </Tooltip>
    );
  }
  return null;
}

function SourcesList({ chunks }: { chunks: ChunkDetail[] }) {
  const [isOpen, setIsOpen] = useState(false);
  if (!chunks || chunks.length === 0) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button className="inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground">
          {isOpen ? <ChevronDown className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />}
          <FileText className="h-2.5 w-2.5" />
          {chunks.length} source{chunks.length !== 1 ? 's' : ''}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1.5 space-y-1">
        {chunks.map((chunk, index) => (
          <div key={chunk.chunk_id || index} className="rounded border border-border/50 bg-muted/30 px-2.5 py-1.5 text-[11px]">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-foreground truncate">{chunk.source_title || chunk.title}</span>
              <span className="shrink-0 text-muted-foreground">{(chunk.score * 100).toFixed(0)}%</span>
            </div>
            {chunk.content_preview && (
              <p className="mt-1 text-muted-foreground line-clamp-2 leading-relaxed">{chunk.content_preview}</p>
            )}
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

function TextSelectionPopover({
  position,
  onAdd,
  onClose,
}: {
  position: PopoverPosition | null;
  onAdd: (quote: SelectedQuote) => void;
  onClose: () => void;
}) {
  if (!position) return null;

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onAdd({
      id: `quote-${Date.now()}`,
      text: position.text,
      source: position.source,
      messageId: position.messageId,
      stepIndex: position.stepIndex,
      stepType: position.stepType,
    });
    onClose();
  };

  return createPortal(
    <div
      data-text-selection-popover
      className="fixed z-9999 flex items-center rounded-lg border border-border bg-popover px-1 py-0.5 shadow-lg animate-in fade-in-0 zoom-in-95 duration-100"
      style={{ left: position.x, top: position.y, pointerEvents: 'auto' }}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={handleAdd}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-popover-foreground transition-colors hover:bg-accent"
      >
        <Plus className="h-3 w-3" />
        Quote for correction
      </button>
    </div>,
    document.body
  );
}

// ============================================================================
// Inline Correction Form
// ============================================================================

interface InlineCorrectionFormProps {
  message: ChatMessage;
  quotes: SelectedQuote[];
  onRemoveQuote: (id: string) => void;
  onSuccess: () => void;
  onCancel: () => void;
}

function InlineCorrectionForm({
  message,
  quotes,
  onRemoveQuote,
  onSuccess,
  onCancel,
}: InlineCorrectionFormProps) {
  const queryClient = useQueryClient();
  const [correctionNotes, setCorrectionNotes] = useState('');
  const [result, setResult] = useState<CreateCorrectionResponse | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      textareaRef.current?.focus();
    });
  }, []);

  const mutation = useMutation({
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

    const contextQuotes = quotes
      .map((q) => ({
        text: q.text,
        source: q.source,
        step_index: q.stepIndex,
        step_type: q.stepType,
      }));

    mutation.mutate({
      message_id: message.id,
      correction_notes: correctionNotes.trim(),
      ...(contextQuotes.length > 0 && { context_quotes: contextQuotes }),
    });
  };

  const isSubmitting = mutation.isPending;
  const isValid = correctionNotes.trim().length >= 10;
  const showResult = !!result && !result.error;

  const relevantQuotes = quotes;

  if (showResult) {
    return (
      <div ref={formRef} className="mx-4 mb-1 ml-11.5 animate-in slide-in-from-top-2 duration-200">
        <div className="rounded-lg border border-emerald-200/60 dark:border-emerald-800/30 bg-emerald-50/50 dark:bg-emerald-950/20 p-3 space-y-2">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
            <CheckCircle className="h-4 w-4" />
            <span className="text-xs font-medium">Correction created</span>
          </div>
          {result.processed_title && (
            <div className="rounded-md border border-border/50 bg-background/80 px-3 py-2 space-y-1">
              <p className="text-xs font-medium text-foreground">{result.processed_title}</p>
              {result.processed_content && (
                <p className="text-[11px] text-muted-foreground line-clamp-3">{result.processed_content}</p>
              )}
            </div>
          )}
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onSuccess}>
            Done
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div ref={formRef} className="mx-4 mb-1 ml-11.5 animate-in slide-in-from-top-2 duration-200">
      <div className="rounded-lg border border-primary/20 bg-primary/2 dark:bg-primary/5 p-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <Wand2 className="h-3.5 w-3.5 text-primary" />
            Create Correction
          </div>
          <button
            onClick={onCancel}
            disabled={isSubmitting}
            className="rounded-md p-0.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Quoted context chips */}
        {relevantQuotes.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {relevantQuotes.map((q) => (
              <Tooltip key={q.id}>
                <TooltipTrigger asChild>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] max-w-[220px] cursor-default',
                      q.source === 'reasoning'
                        ? 'bg-violet-500/10 text-violet-700 dark:text-violet-300'
                        : 'bg-muted text-foreground'
                    )}
                  >
                    <span className="truncate">&ldquo;{q.text}&rdquo;</span>
                    <button
                      onClick={() => onRemoveQuote(q.id)}
                      disabled={isSubmitting}
                      className="shrink-0 opacity-50 hover:opacity-100"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs whitespace-pre-wrap">
                  {q.text}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        )}

        <Textarea
          ref={textareaRef}
          value={correctionNotes}
          onChange={(e) => setCorrectionNotes(e.target.value)}
          placeholder="What should the correct response be?"
          disabled={isSubmitting}
          rows={3}
          className={cn(
            'text-xs resize-none bg-background/80',
            !isValid && correctionNotes.length > 0 && 'border-orange-300 dark:border-orange-700'
          )}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              onCancel();
            }
          }}
        />

        <div className="flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground">
            {correctionNotes.length > 0 && correctionNotes.length < 10 && (
              <span className="text-orange-500">{10 - correctionNotes.length} more chars needed</span>
            )}
            {correctionNotes.length >= 10 && (
              <span className="text-emerald-600 dark:text-emerald-400">
                {correctionNotes.length} chars
              </span>
            )}
          </p>
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={handleSubmit}
              disabled={!isValid || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Spinner size="sm" className="mr-1.5" />
                  Creating...
                </>
              ) : (
                <>
                  <Wand2 className="mr-1.5 h-3 w-3" />
                  Create
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Chat Message
// ============================================================================

interface ChatMessageItemProps {
  message: ChatMessage;
  isHighlighted?: boolean;
  onHighlight?: () => void;
  onTextSelect?: (position: PopoverPosition) => void;
  onCreateCorrection?: () => void;
  displayContent?: string;
}

function ChatMessageItem({
  message,
  isHighlighted,
  onHighlight,
  onTextSelect,
  onCreateCorrection,
  displayContent,
}: ChatMessageItemProps) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const content = displayContent ?? message.content;

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!onTextSelect) return;
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    if (text && text.length > 5) {
      const rect = selection?.getRangeAt(0).getBoundingClientRect();
      if (rect) {
        onTextSelect({
          x: rect.left + rect.width / 2 - 65,
          y: rect.bottom + 6,
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
        'group flex gap-2.5 px-4 py-2.5 transition-colors',
        isUser && 'flex-row-reverse',
        isHighlighted && 'bg-primary/4',
      )}
      onClick={() => {
        const selection = window.getSelection();
        if (selection?.toString().trim()) return;
        if (isAssistant) onHighlight?.();
      }}
      onMouseUp={handleMouseUp}
    >
      <div
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full mt-0.5',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
        )}
      >
        {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
      </div>

      <div className={cn('flex min-w-0 max-w-[85%] flex-col gap-1', isUser ? 'items-end' : 'items-start')}>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span>{format(new Date(message.timestamp), 'h:mm a')}</span>
          {isUser && message.query_type && (
            <span className="rounded bg-muted px-1 py-px text-[10px]">{message.query_type}</span>
          )}
          {isAssistant && message.latency_ms && (
            <span className="tabular-nums">{(message.latency_ms / 1000).toFixed(1)}s</span>
          )}
          {isAssistant && message.was_stopped && (
            <span className="text-amber-600">stopped</span>
          )}
        </div>

        {isUser ? (
          <div className="rounded-2xl rounded-tr-sm bg-primary px-3.5 py-2 text-primary-foreground">
            <p className="whitespace-pre-wrap text-[13px] leading-relaxed">{content}</p>
          </div>
        ) : (
          <div className="rounded-2xl rounded-tl-sm bg-muted/50 px-3.5 py-2.5">
            {content ? (
              <div
                className="prose prose-sm dark:prose-invert max-w-none text-[13px] leading-relaxed prose-p:my-1 prose-headings:my-1.5 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-code:rounded prose-code:bg-background/80 prose-code:px-1 prose-code:py-px prose-code:text-xs prose-pre:bg-background/80 prose-pre:rounded-md prose-a:text-primary prose-a:no-underline hover:prose-a:underline"
                dangerouslySetInnerHTML={{ __html: marked.parse(content) as string }}
              />
            ) : (
              <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                <CheckCircle className="h-3.5 w-3.5" />
                Action executed
              </div>
            )}
          </div>
        )}

        {isAssistant && (
          <div className="flex items-center gap-2 mt-0.5">
            <FeedbackIndicator feedback={message.feedback} />
            <SourcesList chunks={message.chunks_details || []} />
            {onCreateCorrection && (
              <button
                onClick={(e) => { e.stopPropagation(); onCreateCorrection(); }}
                className="opacity-0 group-hover:opacity-100 inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-all hover:text-primary"
              >
                <Wand2 className="h-2.5 w-2.5" />
                Correct
              </button>
            )}
          </div>
        )}

        {isAssistant && message.feedback_comment && (
          <div className="rounded-md border border-amber-200/50 bg-amber-50/50 dark:border-amber-800/20 dark:bg-amber-950/20 px-2.5 py-1.5 text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">
            <span className="font-medium">Feedback:</span> {message.feedback_comment}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Reasoning Timeline (Side Panel)
// ============================================================================

interface TimelineEntry {
  type: 'user' | 'reasoning';
  messageId: string;
  content?: string;
  step?: ReasoningStep;
  stepIndex?: number;
}

const STEP_COLORS: Record<string, string> = {
  action_search: 'bg-fuchsia-500',
  decision: 'bg-violet-500',
  search: 'bg-blue-500',
  source_eval: 'bg-amber-500',
  answer: 'bg-emerald-500',
  action: 'bg-rose-500',
};

function ActionSearchDetail({ step }: { step: ReasoningStep }) {
  const [open, setOpen] = useState(false);
  const candidates = step.action_candidates || [];
  const top = candidates[0];

  if (candidates.length === 0) {
    return (
      <>
        <span>Found {step.actions_found || 0} actions</span>
        {step.top_action && (
          <div className="flex items-center gap-1 mt-0.5">
            <Badge variant="outline" className="text-[9px] h-3.5 px-1">{step.top_action}</Badge>
            {step.top_score !== undefined && (
              <span className="text-muted-foreground text-[9px]">{(step.top_score * 100).toFixed(0)}%</span>
            )}
          </div>
        )}
      </>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="flex items-center gap-1">
        <span>{step.actions_found || 0} actions</span>
        {step.rerank_enabled && (
          <span className="text-[9px] text-muted-foreground" title={step.rerank_changed_top ? 'Reranking changed top' : 'Confirmed'}>
            {step.rerank_changed_top ? '↻' : '✓'}
          </span>
        )}
        {candidates.length > 1 && (
          <CollapsibleTrigger asChild>
            <button className="p-0.5 rounded hover:bg-accent" onClick={(e) => e.stopPropagation()}>
              {open ? <ChevronDown className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />}
            </button>
          </CollapsibleTrigger>
        )}
      </div>
      {top && (
        <div className="flex items-center gap-1 mt-0.5">
          <Badge variant="default" className="text-[9px] h-3.5 px-1">{top.name}</Badge>
          <span className="text-[9px] text-muted-foreground">{(top.score * 100).toFixed(0)}%</span>
        </div>
      )}
      {candidates.length > 1 && (
        <CollapsibleContent className="mt-1 pl-1.5 border-l border-border/50 space-y-0.5">
          {candidates.slice(1).map((c: ActionCandidate) => (
            <div key={c.name} className="flex items-center gap-1">
              <Badge variant="outline" className="text-[9px] h-3.5 px-1">{c.name}</Badge>
              <span className="text-[9px] text-muted-foreground">{(c.score * 100).toFixed(0)}%</span>
            </div>
          ))}
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}

function ReasoningTimeline({
  messages,
  highlightedMessageId,
  onHighlight,
  onTextSelect,
}: {
  messages: ChatMessage[];
  highlightedMessageId: string | null;
  onHighlight: (id: string) => void;
  onTextSelect: (position: PopoverPosition) => void;
}) {
  const timeline: TimelineEntry[] = [];
  for (const msg of messages) {
    if (msg.role === 'user') {
      timeline.push({ type: 'user', messageId: msg.id, content: msg.content });
    } else if (msg.role === 'assistant') {
      const trace = msg.reasoning_trace || [];
      if (trace.length > 0) {
        trace.forEach((step, i) => timeline.push({ type: 'reasoning', messageId: msg.id, step, stepIndex: i }));
      } else {
        timeline.push({
          type: 'reasoning',
          messageId: msg.id,
          step: { step_type: 'answer', iteration: 0, timestamp_ms: 0, sources_used_count: msg.chunks_details?.length || 0 },
          stepIndex: 0,
        });
      }
    }
  }

  const handleMouseUp = (e: React.MouseEvent, messageId: string, stepIndex?: number, stepType?: string) => {
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    if (text && text.length > 5) {
      const rect = selection?.getRangeAt(0).getBoundingClientRect();
      if (rect) {
        onTextSelect({
          x: rect.left + rect.width / 2 - 65,
          y: rect.bottom + 6,
          text,
          source: 'reasoning',
          messageId,
          stepIndex,
          stepType,
        });
      }
    }
  };

  if (timeline.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
        <Brain className="h-6 w-6 opacity-40" />
        <p className="text-xs">No reasoning data</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-px">
      {timeline.map((entry, idx) => {
        if (entry.type === 'user') {
          return (
            <div
              key={`u-${idx}`}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-muted-foreground bg-muted/30"
              onMouseUp={(e) => handleMouseUp(e, entry.messageId)}
            >
              <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <User className="h-2 w-2" />
              </div>
              <span className="truncate">{entry.content?.slice(0, 60)}{(entry.content?.length || 0) > 60 ? '...' : ''}</span>
            </div>
          );
        }

        const step = entry.step!;
        const lit = entry.messageId === highlightedMessageId;

        return (
          <div
            key={`s-${idx}`}
            className={cn(
              'relative px-3 py-1.5 pl-5 text-[11px] cursor-default transition-colors select-text',
              lit ? 'bg-primary/6' : 'hover:bg-muted/40'
            )}
            onClick={() => {
              const sel = window.getSelection();
              if (sel?.toString().trim()) return;
              onHighlight(entry.messageId);
            }}
            onMouseUp={(e) => {
              e.stopPropagation();
              handleMouseUp(e, entry.messageId, entry.stepIndex, step.step_type);
            }}
          >
            <div className={cn('absolute left-2 top-[9px] h-1.5 w-1.5 rounded-full', STEP_COLORS[step.step_type] || 'bg-muted-foreground')} />

            <div className="flex items-center gap-1.5 text-muted-foreground">
              <span className="font-semibold uppercase tracking-wide text-[9px]">{step.step_type.replace('_', ' ')}</span>
              {step.timestamp_ms > 0 && <span className="text-[9px] tabular-nums opacity-50">{step.timestamp_ms}ms</span>}
            </div>

            <div className="text-muted-foreground leading-snug mt-px">
              {step.step_type === 'action_search' && <ActionSearchDetail step={step} />}
              {step.step_type === 'decision' && (
                <>
                  <div className="flex items-center gap-1 flex-wrap">
                    <Badge variant="outline" className="text-[9px] h-3.5 px-1">{step.decision}</Badge>
                    {step.action_name && <Badge variant="secondary" className="text-[9px] h-3.5 px-1">{step.action_name}</Badge>}
                  </div>
                  {step.thought && <p className="text-[10px] mt-0.5 opacity-70 line-clamp-2">{step.thought}</p>}
                </>
              )}
              {step.step_type === 'search' && (
                <code className="text-[10px] bg-muted px-1 py-px rounded">{step.search_query}</code>
              )}
              {step.step_type === 'source_eval' && <span>{step.sources_evaluated?.length || 0} sources evaluated</span>}
              {step.step_type === 'answer' && <span>Answer using {step.sources_used_count || 0} sources</span>}
              {step.step_type === 'action' && (
                <div className="flex items-center gap-1">
                  {step.action_name && <Badge variant="outline" className="text-[9px] h-3.5 px-1">{step.action_name}</Badge>}
                  {step.action_matched !== undefined && (
                    <span className="text-[9px]">{step.action_matched ? '✓ matched' : '✗ no match'}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Translation Banner
// ============================================================================

function TranslationBanner({
  translation,
}: {
  translation: ReturnType<typeof useConversationTranslation>;
}) {
  if (!translation.hasNonEnglishContent) return null;

  return (
    <div className="flex items-center justify-between gap-2 px-4 py-2 bg-blue-50/80 dark:bg-blue-950/20 border-b border-blue-100 dark:border-blue-900/30 text-xs text-blue-700 dark:text-blue-300 flex-wrap shrink-0">
      <div className="flex items-center gap-1.5 min-w-0">
        <Languages className="h-3.5 w-3.5 shrink-0" />
        <span>
          {translation.languageName
            ? `Conversation in ${translation.languageName}`
            : 'Non-English conversation'}
        </span>
      </div>
      {translation.isTranslating ? (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Spinner size="sm" />
          <span>Translating...</span>
        </div>
      ) : translation.isTranslated ? (
        <button
          className="rounded-full px-2.5 py-0.5 text-[11px] font-medium bg-muted text-muted-foreground border border-border hover:bg-accent transition-colors"
          onClick={translation.untranslate}
        >
          Show original
        </button>
      ) : (
        <button
          className="rounded-full px-2.5 py-0.5 text-[11px] font-medium text-blue-700 dark:text-blue-300 bg-blue-100/80 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800/40 hover:bg-blue-200/80 dark:hover:bg-blue-900/50 transition-colors"
          onClick={translation.translate}
        >
          Translate to English
        </button>
      )}
      {translation.error && (
        <p className="w-full text-[11px] text-muted-foreground mt-0.5">{translation.error}</p>
      )}
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

  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [selectedQuotes, setSelectedQuotes] = useState<SelectedQuote[]>([]);
  const [popoverPosition, setPopoverPosition] = useState<PopoverPosition | null>(null);
  const [correctionMessageId, setCorrectionMessageId] = useState<string | null>(null);

  const { data: conversation, isPending, isError } = useQuery({
    ...conversationDetailQuery(conversationId || ''),
    enabled: !!conversationId && open,
  });

  const translation = useConversationTranslation(conversation?.messages);

  const hasReasoningData = conversation?.messages.some(
    (m) => m.role === 'assistant' && m.reasoning_trace && m.reasoning_trace.length > 0
  );

  useEffect(() => {
    if (conversation?.messages && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [conversation?.messages]);

  useEffect(() => {
    if (!open) {
      setHighlightedMessageId(null);
      setSelectedQuotes([]);
      setPopoverPosition(null);
      setCorrectionMessageId(null);
    }
  }, [open]);

  useEffect(() => {
    if (!popoverPosition) return;
    const handle = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('[data-text-selection-popover]')) return;
      setPopoverPosition(null);
    };
    const t = setTimeout(() => document.addEventListener('mousedown', handle), 50);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', handle); };
  }, [popoverPosition]);

  const handleHighlight = useCallback((id: string) => {
    setHighlightedMessageId((prev) => (prev === id ? null : id));
  }, []);

  const handleTextSelect = useCallback((pos: PopoverPosition) => {
    setPopoverPosition(pos);
  }, []);

  const resolveAssistantMessageId = useCallback((messageId: string): string | null => {
    if (!conversation?.messages) return null;
    const msg = conversation.messages.find((m) => m.id === messageId);
    if (msg?.role === 'assistant') return messageId;

    const idx = conversation.messages.findIndex((m) => m.id === messageId);
    // Look forward for the next assistant message
    for (let i = idx + 1; i < conversation.messages.length; i++) {
      if (conversation.messages[i].role === 'assistant') return conversation.messages[i].id;
    }
    // Fallback: look backward
    for (let i = idx - 1; i >= 0; i--) {
      if (conversation.messages[i].role === 'assistant') return conversation.messages[i].id;
    }
    return null;
  }, [conversation?.messages]);

  const handleAddQuote = useCallback((quote: SelectedQuote) => {
    const targetId = resolveAssistantMessageId(quote.messageId);

    // Switching to a different message -- reset quotes
    if (targetId && targetId !== correctionMessageId) {
      setSelectedQuotes([{
        ...quote,
      }]);
      setCorrectionMessageId(targetId);
    } else {
      setSelectedQuotes((prev) => {
        if (prev.some((q) => q.text === quote.text && q.messageId === quote.messageId)) return prev;
        return [...prev, quote];
      });
      if (targetId) {
        setCorrectionMessageId(targetId);
      }
    }
  }, [resolveAssistantMessageId, correctionMessageId]);

  const handleRemoveQuote = useCallback((id: string) => {
    setSelectedQuotes((prev) => prev.filter((q) => q.id !== id));
  }, []);

  const handleCorrectionSuccess = useCallback(() => {
    setCorrectionMessageId(null);
    setSelectedQuotes([]);
    onCorrectionCreated?.();
  }, [onCorrectionCreated]);

  const handleCorrectionCancel = useCallback(() => {
    setCorrectionMessageId(null);
  }, []);

  const statusStyle: Record<string, string> = {
    active: 'bg-blue-500/10 text-blue-600 ring-blue-500/20 dark:text-blue-400',
    resolved: 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400',
    escalated: 'bg-red-500/10 text-red-600 ring-red-500/20 dark:text-red-400',
    abandoned: 'bg-zinc-500/10 text-zinc-500 ring-zinc-500/20',
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          data-conversation-drawer
          onPointerDownOutside={(e) => {
            if ((e.target as HTMLElement)?.closest('[data-text-selection-popover]')) {
              e.preventDefault();
            }
          }}
          className={cn(
            'flex flex-col gap-0 p-0 overflow-hidden h-[90vh]',
            hasReasoningData ? 'max-w-6xl' : 'max-w-3xl',
          )}
        >
          {/* Header */}
          <DialogHeader className="shrink-0 border-b border-border px-5 pt-4 pb-3">
            <div className="flex items-center gap-2.5 pr-8">
              <DialogTitle className="text-sm font-semibold truncate">
                Conversation Details
              </DialogTitle>
              {conversation && (
                <span className={cn('shrink-0 rounded-full px-1.5 py-px text-[10px] font-medium capitalize ring-1 ring-inset', statusStyle[conversation.status] || statusStyle.active)}>
                  {conversation.status}
                </span>
              )}
            </div>
            {conversation && (
              <DialogDescription asChild>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground mt-1">
                  <span className="flex items-center gap-1">
                    <Clock className="h-2.5 w-2.5 opacity-50" />
                    {format(new Date(conversation.started_at), 'MMM d, yyyy · h:mm a')}
                    <span className="opacity-40">
                      ({formatDistanceToNow(new Date(conversation.started_at), { addSuffix: true })})
                    </span>
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageSquare className="h-2.5 w-2.5 opacity-50" />
                    {conversation.message_count} messages
                  </span>
                  {conversation.visitor && (
                    <button
                      onClick={() => onVisitorClick?.(conversation.visitor!.id)}
                      className="flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                      <User className="h-2.5 w-2.5 opacity-50" />
                      <span className="underline underline-offset-2">
                        {conversation.visitor.name || conversation.visitor.email || 'Unknown User'}
                      </span>
                    </button>
                  )}
                  {conversation.page_url && (
                    <a
                      href={conversation.page_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-0.5 text-primary hover:underline underline-offset-2"
                    >
                      <Globe className="h-2.5 w-2.5" />
                      {(() => { try { return new URL(conversation.page_url).pathname; } catch { return 'Page'; } })()}
                      <ExternalLink className="h-2 w-2 opacity-50" />
                    </a>
                  )}
                  {conversation.has_negative_feedback && (
                    <span className="flex items-center gap-0.5 text-amber-600 dark:text-amber-400">
                      <ThumbsDown className="h-2.5 w-2.5" /> Negative feedback
                    </span>
                  )}
                </div>
              </DialogDescription>
            )}
          </DialogHeader>

          {/* Escalation alert */}
          {conversation?.status === 'escalated' && conversation.escalation_reason && (
            <div className="mx-4 mt-3 flex items-start gap-2 rounded-md border border-red-200/50 bg-red-50/50 dark:border-red-800/20 dark:bg-red-950/20 px-3 py-2 text-xs text-red-700 dark:text-red-300">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-px" />
              <div>
                <span className="font-medium">Escalated:</span> {conversation.escalation_reason}
              </div>
            </div>
          )}

          {/* Body */}
          <div className="flex flex-1 min-h-0">
            {isPending && (
              <div className="flex flex-1 items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                  <Spinner size="lg" />
                  <p className="text-xs text-muted-foreground">Loading conversation...</p>
                </div>
              </div>
            )}

            {isError && (
              <div className="flex flex-1 items-center justify-center">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <AlertCircle className="h-6 w-6" />
                  <p className="text-xs">Failed to load conversation</p>
                </div>
              </div>
            )}

            {conversation && (
              <>
                {/* Chat column */}
                <div className={cn('flex flex-1 flex-col min-w-0 overflow-hidden', hasReasoningData && 'border-r border-border')}>
                  <TranslationBanner translation={translation} />
                  <ScrollArea className="flex-1 overflow-hidden">
                    <div className="divide-y divide-border/30">
                      {conversation.messages.map((message) => (
                        <div key={message.id}>
                          <ChatMessageItem
                            message={message}
                            isHighlighted={highlightedMessageId === message.id}
                            onHighlight={() => handleHighlight(message.id)}
                            onTextSelect={handleTextSelect}
                            onCreateCorrection={
                              message.role === 'assistant'
                                ? () => {
                                    if (correctionMessageId === message.id) {
                                      setCorrectionMessageId(null);
                                    } else {
                                      setSelectedQuotes([]);
                                      setCorrectionMessageId(message.id);
                                    }
                                  }
                                : undefined
                            }
                            displayContent={
                              translation.isTranslated
                                ? translation.getTranslatedContent(message.id, message.content)
                                : undefined
                            }
                          />

                          {/* Inline correction form appears right below the target message */}
                          {correctionMessageId === message.id && (
                            <InlineCorrectionForm
                              message={message}
                              quotes={selectedQuotes}
                              onRemoveQuote={handleRemoveQuote}
                              onSuccess={handleCorrectionSuccess}
                              onCancel={handleCorrectionCancel}
                            />
                          )}
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  </ScrollArea>

                  {/* Quotes tray */}
                  {selectedQuotes.length > 0 && !correctionMessageId && (
                    <div className="shrink-0 border-t border-border bg-muted/20 px-4 py-2">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                          Quoted for correction ({selectedQuotes.length})
                        </span>
                        <button onClick={() => setSelectedQuotes([])} className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                          Clear
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {selectedQuotes.map((q) => (
                          <span key={q.id} className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] text-foreground max-w-[180px]">
                            <span className="truncate">&ldquo;{q.text}&rdquo;</span>
                            <button onClick={() => handleRemoveQuote(q.id)} className="shrink-0 opacity-50 hover:opacity-100">
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Reasoning sidebar */}
                {hasReasoningData && (
                  <div className="hidden md:flex w-[280px] shrink-0 flex-col bg-muted/10 overflow-hidden">
                    <div className="shrink-0 flex items-center gap-1.5 px-3 py-2 border-b border-border text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                      <Brain className="h-3 w-3" />
                      Reasoning
                    </div>
                    <ScrollArea className="flex-1 overflow-hidden">
                      <ReasoningTimeline
                        messages={conversation.messages}
                        highlightedMessageId={highlightedMessageId}
                        onHighlight={handleHighlight}
                        onTextSelect={handleTextSelect}
                      />
                    </ScrollArea>
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Text Selection Popover -- portaled to body, Dialog's onPointerDownOutside prevents dismiss */}
      <TextSelectionPopover
        position={popoverPosition}
        onAdd={handleAddQuote}
        onClose={() => setPopoverPosition(null)}
      />
    </>
  );
}
