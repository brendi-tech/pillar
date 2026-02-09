'use client';

import { format } from 'date-fns';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MessageSquare,
  ThumbsDown,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ChatConversationListItem, ConversationStatus } from '@/types/admin';

interface ConversationsTableProps {
  conversations: ChatConversationListItem[];
  isLoading: boolean;
  isError: boolean;
  onRowClick: (conversation: ChatConversationListItem) => void;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function getStatusBadgeVariant(
  status: ConversationStatus
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'resolved':
      return 'default';
    case 'escalated':
      return 'destructive';
    case 'active':
      return 'secondary';
    case 'abandoned':
      return 'outline';
    default:
      return 'secondary';
  }
}

function getStatusLabel(status: ConversationStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function ConversationsTable({
  conversations,
  isLoading,
  isError,
  onRowClick,
  page,
  totalPages,
  onPageChange,
}: ConversationsTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
        <AlertCircle className="h-8 w-8" />
        <p>Failed to load conversations</p>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
        <MessageSquare className="h-8 w-8" />
        <p>No conversations found</p>
        <p className="text-sm">Try adjusting your filters or date range</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">Started</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead className="w-[80px] text-center">Messages</TableHead>
              <TableHead>First Question</TableHead>
              <TableHead className="w-[60px] text-center">Feedback</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {conversations.map((conversation) => (
              <TableRow
                key={conversation.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onRowClick(conversation)}
              >
                <TableCell className="text-muted-foreground">
                  {format(new Date(conversation.started_at), 'MMM d, h:mm a')}
                </TableCell>
                <TableCell>
                  <Badge variant={getStatusBadgeVariant(conversation.status)}>
                    {getStatusLabel(conversation.status)}
                  </Badge>
                </TableCell>
                <TableCell className="text-center text-muted-foreground">
                  {conversation.message_count}
                </TableCell>
                <TableCell className="max-w-[400px]">
                  <p className="truncate text-sm">
                    {conversation.first_user_message || (
                      <span className="text-muted-foreground italic">
                        No message
                      </span>
                    )}
                  </p>
                </TableCell>
                <TableCell className="text-center">
                  {conversation.has_negative_feedback && (
                    <ThumbsDown className="mx-auto h-4 w-4 text-orange-500" />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page + 1)}
              disabled={page === totalPages}
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
