"use client";

import { Filter } from "lucide-react";
import { useState } from "react";

import { DateRangePicker } from "@/components/DateRangePicker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type {
  AnalyticsDateRange,
  ConversationStatus,
  QueryType,
} from "@/types/admin";

export interface ConversationsFiltersState {
  status: ConversationStatus | "all";
  hasNegativeFeedback: boolean | undefined;
  queryType: QueryType | "all";
  intentCategory: string;
  channel: string;
  search: string;
}

interface FilterControlsProps {
  filters: ConversationsFiltersState;
  onFiltersChange: (filters: ConversationsFiltersState) => void;
  layout?: "horizontal" | "vertical";
}

interface ConversationsFiltersProps extends FilterControlsProps {
  dateRange: AnalyticsDateRange;
  onDateRangeChange: (dateRange: AnalyticsDateRange) => void;
}

function FilterControls({
  filters,
  onFiltersChange,
  layout = "horizontal",
}: FilterControlsProps) {
  const isVertical = layout === "vertical";

  return (
    <div
      className={
        isVertical ? "flex flex-col gap-4" : "flex flex-wrap items-center gap-4"
      }
    >
      {/* Status Filter */}
      <div
        className={
          isVertical ? "flex flex-col gap-2" : "flex items-center gap-2"
        }
      >
        <span className="text-sm text-muted-foreground">Status:</span>
        <Select
          value={filters.status}
          onValueChange={(value) => {
            onFiltersChange({
              ...filters,
              status: value as ConversationStatus | "all",
            });
          }}
        >
          <SelectTrigger className={isVertical ? "w-full" : "w-[140px]"}>
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="escalated">Escalated</SelectItem>
            <SelectItem value="abandoned">Abandoned</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Negative Feedback Filter */}
      <div
        className={
          isVertical ? "flex flex-col gap-2" : "flex items-center gap-2"
        }
      >
        <span className="text-sm text-muted-foreground">Feedback:</span>
        <Select
          value={
            filters.hasNegativeFeedback === undefined
              ? "all"
              : filters.hasNegativeFeedback
                ? "negative"
                : "positive"
          }
          onValueChange={(value) => {
            onFiltersChange({
              ...filters,
              hasNegativeFeedback:
                value === "all" ? undefined : value === "negative",
            });
          }}
        >
          <SelectTrigger className={isVertical ? "w-full" : "w-[160px]"}>
            <SelectValue placeholder="All feedback" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="negative">Has Negative</SelectItem>
            <SelectItem value="positive">No Negative</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Channel Filter */}
      <div
        className={
          isVertical ? "flex flex-col gap-2" : "flex items-center gap-2"
        }
      >
        <span className="text-sm text-muted-foreground">Channel:</span>
        <Select
          value={filters.channel || "all"}
          onValueChange={(value) => {
            onFiltersChange({
              ...filters,
              channel: value === "all" ? "" : value,
            });
          }}
        >
          <SelectTrigger className={isVertical ? "w-full" : "w-[130px]"}>
            <SelectValue placeholder="All channels" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="web">Web</SelectItem>
            <SelectItem value="slack">Slack</SelectItem>
            <SelectItem value="discord">Discord</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="api">API</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Query Type Filter */}
      <div
        className={
          isVertical ? "flex flex-col gap-2" : "flex items-center gap-2"
        }
      >
        <span className="text-sm text-muted-foreground">Type:</span>
        <Select
          value={filters.queryType}
          onValueChange={(value) => {
            onFiltersChange({
              ...filters,
              queryType: value as QueryType | "all",
            });
          }}
        >
          <SelectTrigger className={isVertical ? "w-full" : "w-[120px]"}>
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="ask">Ask</SelectItem>
            <SelectItem value="search">Search</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Intent Category Filter */}
      <div
        className={
          isVertical ? "flex flex-col gap-2" : "flex items-center gap-2"
        }
      >
        {isVertical && (
          <span className="text-sm text-muted-foreground">Intent:</span>
        )}
        <Input
          placeholder="Intent category..."
          value={filters.intentCategory}
          onChange={(e) => {
            onFiltersChange({
              ...filters,
              intentCategory: e.target.value,
            });
          }}
          className={isVertical ? "w-full" : "w-[160px]"}
        />
      </div>

      {/* Search */}
      <div
        className={isVertical ? "flex flex-col gap-2" : "flex-1 min-w-[200px]"}
      >
        {isVertical && (
          <span className="text-sm text-muted-foreground">Search:</span>
        )}
        <Input
          placeholder="Search in messages..."
          value={filters.search}
          onChange={(e) => {
            onFiltersChange({
              ...filters,
              search: e.target.value,
            });
          }}
          className={isVertical ? "w-full" : "max-w-sm"}
        />
      </div>
    </div>
  );
}

function getActiveFilterCount(filters: ConversationsFiltersState): number {
  let count = 0;
  if (filters.status !== "all") count++;
  if (filters.hasNegativeFeedback !== undefined) count++;
  if (filters.queryType !== "all") count++;
  if (filters.intentCategory) count++;
  if (filters.channel) count++;
  if (filters.search) count++;
  return count;
}

export function ConversationsFilters({
  filters,
  onFiltersChange,
  dateRange,
  onDateRangeChange,
}: ConversationsFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const activeFilterCount = getActiveFilterCount(filters);

  return (
    <>
      {/* Desktop: Inline filters */}
      <div className="hidden md:block">
        <FilterControls
          filters={filters}
          onFiltersChange={onFiltersChange}
          layout="horizontal"
        />
      </div>

      {/* Mobile: Date range + Filter button */}
      <div className="flex items-center gap-2 md:hidden">
        <DateRangePicker value={dateRange} onChange={onDateRangeChange} />
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Filter className="h-4 w-4" />
              Filters
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 text-xs">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-auto max-h-[80vh] px-4 pb-4">
            <SheetHeader className="px-0">
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            <div className="pb-4">
              <FilterControls
                filters={filters}
                onFiltersChange={onFiltersChange}
                layout="vertical"
              />
              <Button className="mt-6 w-full" onClick={() => setIsOpen(false)}>
                Apply Filters
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
