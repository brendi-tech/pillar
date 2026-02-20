"use client";

import { Bell } from "lucide-react";

interface CardComponentProps<T = Record<string, unknown>> {
  data: T;
  onConfirm: (modifiedData?: Record<string, unknown>) => void;
  onCancel: () => void;
}

export function SetUsageAlertCard({
  onCancel,
}: CardComponentProps) {
  return (
    <div className="mt-3 w-full rounded-lg border border-dashed bg-muted/30 p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Bell className="h-4 w-4" />
        <span className="text-sm">
          Usage alerts aren&apos;t available yet — billing is coming soon.
        </span>
      </div>
    </div>
  );
}
