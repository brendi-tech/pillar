"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AIUsageStats } from "@/types/admin";
import { MessageSquare } from "lucide-react";

interface TopQuestionsProps {
  questions: AIUsageStats["topQuestions"];
  isLoading?: boolean;
}

function LoadingSkeleton() {
  return (
    <Card className="admin-card">
      <CardHeader>
        <div className="h-5 w-32 admin-shimmer rounded" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-6 w-6 admin-shimmer rounded-full" />
              <div className="h-4 flex-1 admin-shimmer rounded" />
              <div className="h-5 w-12 admin-shimmer rounded" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function TopQuestions({ questions, isLoading }: TopQuestionsProps) {
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  const hasQuestions = questions && questions.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Questions</CardTitle>
      </CardHeader>
      <CardContent>
        {hasQuestions ? (
          <div className="space-y-1">
            {questions.slice(0, 10).map((q, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-accent/50"
              >
                <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                  {i + 1}
                </div>
                <MessageSquare className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                  {q.question}
                </span>
                <Badge variant="secondary" className="flex-shrink-0">
                  {q.count}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <MessageSquare className="h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">
              No questions yet
            </p>
            <p className="text-xs text-muted-foreground/70">
              Questions will appear here as customers interact with the AI
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
