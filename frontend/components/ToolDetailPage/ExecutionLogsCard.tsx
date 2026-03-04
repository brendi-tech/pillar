import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";
import { CheckCircle2, XCircle } from "lucide-react";

import type { ExecutionLogItemProps, ExecutionLogsCardProps } from "./ToolDetailPage.types";

export function ExecutionLogsCard({ logs }: ExecutionLogsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Executions</CardTitle>
        <CardDescription>
          Last 20 executions from MCP server and WebMCP
        </CardDescription>
      </CardHeader>
      <CardContent>
        {logs && logs.length > 0 ? (
          <div className="space-y-2">
            {logs.map((log) => (
              <ExecutionLogItem key={log.id} log={log} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No executions recorded yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ExecutionLogItem({ log }: ExecutionLogItemProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
      <div className="flex items-center gap-3">
        {log.status === "success" ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        ) : (
          <XCircle className="h-4 w-4 text-red-500" />
        )}
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {log.status === "success" ? "Success" : "Failed"}
            </span>
            {log.metadata?.source && (
              <Badge variant="outline" className="text-xs">
                {log.metadata.source}
              </Badge>
            )}
          </div>
          {log.error_message && (
            <p className="text-xs text-muted-foreground">{log.error_message}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        {log.duration_ms !== null && (
          <span className="tabular-nums">{log.duration_ms}ms</span>
        )}
        <span>
          {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
        </span>
      </div>
    </div>
  );
}
