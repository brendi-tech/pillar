import type { ExecutionFlagsProps } from "./ToolDetailPage.types";

export function ExecutionFlags({
  autoRun,
  autoComplete,
  returnsData,
}: ExecutionFlagsProps) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center gap-3">
        <FlagIndicator label="Auto-run" enabled={autoRun} color="emerald" />
        <FlagIndicator
          label="Auto-complete"
          enabled={autoComplete}
          color="emerald"
        />
        <FlagIndicator label="Returns data" enabled={returnsData} color="blue" />
      </div>
    </div>
  );
}

function FlagIndicator({
  label,
  enabled,
  color,
}: {
  label: string;
  enabled: boolean;
  color: "emerald" | "blue";
}) {
  const dotColor = enabled
    ? color === "emerald"
      ? "bg-emerald-500"
      : "bg-blue-500"
    : "bg-muted-foreground/30";

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs ${
        enabled ? "text-foreground" : "text-muted-foreground/50"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
      {label}
    </span>
  );
}
