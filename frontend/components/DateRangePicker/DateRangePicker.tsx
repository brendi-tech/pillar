"use client";

import { addDays, format, subDays } from "date-fns";
import { CalendarIcon } from "lucide-react";
import * as React from "react";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import type { AnalyticsDateRange } from "@/types/admin";

interface DateRangePickerProps {
  value: AnalyticsDateRange;
  onChange: (range: AnalyticsDateRange) => void;
  className?: string;
}

interface PresetOption {
  label: string;
  value: "7d" | "30d" | "90d";
  getDates: () => { from: Date; to: Date };
}

const PRESETS: PresetOption[] = [
  {
    label: "Last 7 days",
    value: "7d",
    getDates: () => ({
      from: subDays(new Date(), 7),
      to: addDays(new Date(), 1), // Tomorrow ensures today is fully included across timezones
    }),
  },
  {
    label: "Last 30 days",
    value: "30d",
    getDates: () => ({
      from: subDays(new Date(), 30),
      to: addDays(new Date(), 1), // Tomorrow ensures today is fully included across timezones
    }),
  },
  {
    label: "Last 90 days",
    value: "90d",
    getDates: () => ({
      from: subDays(new Date(), 90),
      to: addDays(new Date(), 1), // Tomorrow ensures today is fully included across timezones
    }),
  },
];

export function DateRangePicker({
  value,
  onChange,
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [tempRange, setTempRange] = React.useState<DateRange | undefined>(
    () => ({
      from: new Date(value.start),
      to: new Date(value.end),
    })
  );
  const isMobile = useIsMobile();

  // Update temp range when value changes externally
  React.useEffect(() => {
    if (!open) {
      setTempRange({
        from: new Date(value.start),
        to: new Date(value.end),
      });
    }
  }, [value, open]);

  const handlePresetClick = (preset: PresetOption) => {
    const { from, to } = preset.getDates();
    onChange({
      start: format(from, "yyyy-MM-dd"),
      end: format(to, "yyyy-MM-dd"),
      preset: preset.value,
    });
    setOpen(false);
  };

  const handleSelect = (range: DateRange | undefined) => {
    setTempRange(range);
  };

  const handleApply = () => {
    if (tempRange?.from && tempRange?.to) {
      onChange({
        start: format(tempRange.from, "yyyy-MM-dd"),
        end: format(tempRange.to, "yyyy-MM-dd"),
        preset: "custom",
      });
    }
    setOpen(false);
  };

  const formatDisplayRange = (): string => {
    // Check if it matches a preset
    const preset = PRESETS.find((p) => p.value === value.preset);
    if (preset) {
      return preset.label;
    }

    // Custom range
    const start = new Date(value.start);
    const end = new Date(value.end);
    return `${format(start, "MMM d, yyyy")} - ${format(end, "MMM d, yyyy")}`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("justify-start text-left font-normal gap-2", className)}
        >
          <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{formatDisplayRange()}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto max-w-[calc(100vw-2rem)] p-0"
        align={isMobile ? "center" : "end"}
        sideOffset={8}
      >
        <div className="flex flex-col sm:flex-row">
          {/* Presets */}
          <div className="flex flex-row sm:flex-col gap-1 border-b sm:border-b-0 sm:border-r border-border p-3 overflow-x-auto">
            <p className="hidden sm:block mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Presets
            </p>
            {PRESETS.map((preset) => (
              <Button
                key={preset.value}
                variant="ghost"
                size="sm"
                onClick={() => handlePresetClick(preset)}
                className={cn(
                  "justify-start font-normal whitespace-nowrap",
                  value.preset === preset.value && "bg-accent"
                )}
              >
                {preset.label}
              </Button>
            ))}
          </div>

          {/* Calendar */}
          <div className="p-3 overflow-x-auto flex flex-col items-center sm:items-start relative">
            <Calendar
              mode="range"
              defaultMonth={tempRange?.from}
              selected={tempRange}
              onSelect={handleSelect}
              numberOfMonths={isMobile ? 1 : 2}
              disabled={(date) => date > new Date()}
            />
            <div className="mt-3 flex w-full justify-end gap-2 border-t border-border pt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleApply}
                disabled={!tempRange?.from || !tempRange?.to}
              >
                Apply
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
