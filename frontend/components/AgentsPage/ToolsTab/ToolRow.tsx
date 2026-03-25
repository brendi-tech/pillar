import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ShieldCheck } from "lucide-react";
import type { ToolRowProps } from "./ToolsTab.types";

function ContextCheckbox({
  label,
  checked,
  disabled,
  onToggle,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onToggle: (value: boolean) => void;
}) {
  return (
    <label
      className={cn(
        "inline-flex items-center gap-1 select-none w-[52px] justify-center",
        disabled && "pointer-events-none opacity-30"
      )}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={(val) => onToggle(val === true)}
        disabled={disabled}
        className="h-3.5 w-3.5"
      />
      <span className="text-[10px] font-medium text-muted-foreground">
        {label}
      </span>
    </label>
  );
}

export function ToolRow({
  name,
  description,
  enabled,
  onToggle,
  method,
  path,
  confirmation,
  onConfirmToggle,
  contextControls,
  disabled,
}: ToolRowProps) {
  const isOpenAPI = !!method;

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors group min-h-[36px]",
        enabled ? "hover:bg-muted/50" : "opacity-40"
      )}
    >
      <Checkbox
        checked={enabled}
        onCheckedChange={(checked) => onToggle(checked === true)}
        disabled={disabled}
        className="h-4 w-4 shrink-0"
      />

      {isOpenAPI ? (
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <span className="text-[10px] font-mono font-semibold uppercase text-muted-foreground shrink-0 w-10">
            {method}
          </span>
          <span
            className={cn(
              "text-sm font-mono truncate",
              !enabled
                ? "text-muted-foreground/40"
                : "text-muted-foreground"
            )}
          >
            {path}
          </span>
        </div>
      ) : (
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium">{name}</span>
          {description && (
            <p className="text-xs text-muted-foreground truncate">
              {description}
            </p>
          )}
        </div>
      )}

      <div className="flex items-center gap-3 shrink-0 ml-auto">
        {confirmation && enabled && (
          <ConfirmBadge
            value={confirmation.value}
            readOnly={confirmation.readOnly}
            hasOverride={confirmation.hasOverride}
            onToggle={onConfirmToggle}
          />
        )}

        {contextControls && (
          <div className="flex items-center gap-1.5">
            <ContextCheckbox
              label="DMs"
              checked={enabled ? contextControls.dmsChecked : false}
              onToggle={(val) => contextControls.onDmsToggle(val)}
            />
            <ContextCheckbox
              label="Public"
              checked={enabled ? contextControls.publicChecked : false}
              onToggle={(val) => contextControls.onPublicToggle(val)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function ConfirmBadge({
  value,
  readOnly,
  hasOverride,
  onToggle,
}: {
  value: boolean;
  readOnly: boolean;
  hasOverride?: boolean;
  onToggle?: () => void;
}) {
  if (readOnly) {
    if (!value) return null;
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="shrink-0 inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium bg-muted/50 text-muted-foreground border-border">
              <ShieldCheck className="h-3 w-3" />
              Manual
            </span>
          </TooltipTrigger>
          <TooltipContent side="left" className="text-xs max-w-48">
            Requires user confirmation (set at registration)
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              "shrink-0 inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium transition-all cursor-pointer",
              value
                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800 hover:bg-amber-500/20"
                : "bg-muted/50 text-muted-foreground border-transparent opacity-0 group-hover:opacity-100 group-hover:border-border hover:bg-muted hover:text-foreground",
              hasOverride && "ring-1 ring-amber-500/30"
            )}
            onClick={onToggle}
          >
            <ShieldCheck className="h-3 w-3" />
            Manual
          </button>
        </TooltipTrigger>
        <TooltipContent side="left" className="text-xs max-w-48">
          {hasOverride
            ? "Click to reset to source default"
            : value
              ? "Confirmation required (source default). Click to override."
              : "No confirmation. Click to require confirmation."}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
