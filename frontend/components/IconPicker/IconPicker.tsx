"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import * as LucideIcons from "lucide-react";
import { Search, X } from "lucide-react";
import * as React from "react";

// Curated list of icons suitable for categories/documentation
const ICON_LIST = [
  // Getting Started / Basics
  "Rocket",
  "Sparkles",
  "Zap",
  "Play",
  "PlayCircle",
  "CirclePlay",

  // Documentation / Learning
  "Book",
  "BookOpen",
  "BookText",
  "FileText",
  "Files",
  "Notebook",
  "GraduationCap",
  "Lightbulb",

  // Settings / Configuration
  "Settings",
  "Cog",
  "Sliders",
  "SlidersHorizontal",
  "Wrench",
  "Tool",
  "Gauge",

  // Security / Authentication
  "Shield",
  "ShieldCheck",
  "Lock",
  "Key",
  "KeyRound",
  "Fingerprint",
  "UserCheck",

  // Users / Teams
  "User",
  "Users",
  "UserPlus",
  "UserCircle",
  "Contact",
  "Building",
  "Building2",

  // Communication
  "MessageSquare",
  "MessageCircle",
  "MessagesSquare",
  "Mail",
  "Send",
  "Bell",
  "Megaphone",

  // Data / Analytics
  "BarChart",
  "BarChart2",
  "BarChart3",
  "LineChart",
  "PieChart",
  "TrendingUp",
  "Activity",

  // Integrations / Connections
  "Puzzle",
  "Link",
  "Link2",
  "Plug",
  "Cable",
  "Webhook",
  "RefreshCw",
  "ArrowRightLeft",

  // Payments / Billing
  "CreditCard",
  "Wallet",
  "DollarSign",
  "Receipt",
  "BadgeDollarSign",
  "Coins",

  // Storage / Files
  "Folder",
  "FolderOpen",
  "FolderPlus",
  "Archive",
  "Database",
  "HardDrive",
  "Cloud",
  "CloudUpload",

  // Development / Code
  "Code",
  "Code2",
  "Terminal",
  "Braces",
  "FileCode",
  "GitBranch",
  "Github",

  // Media
  "Image",
  "Video",
  "Camera",
  "Mic",
  "Music",
  "Film",
  "Palette",

  // Navigation / Structure
  "Home",
  "Map",
  "Compass",
  "Navigation",
  "Layers",
  "LayoutGrid",
  "Grid3X3",
  "List",

  // Actions / Tools
  "Download",
  "Upload",
  "Share",
  "Share2",
  "ExternalLink",
  "Copy",
  "Clipboard",
  "Trash2",

  // Status / Feedback
  "CheckCircle",
  "CheckCircle2",
  "AlertCircle",
  "AlertTriangle",
  "Info",
  "HelpCircle",
  "XCircle",

  // Time / Calendar
  "Clock",
  "Timer",
  "Calendar",
  "CalendarDays",
  "History",
  "Hourglass",

  // Objects / Misc
  "Package",
  "Box",
  "Gift",
  "Tag",
  "Tags",
  "Bookmark",
  "Star",
  "Heart",
  "Flag",
  "Target",

  // Arrows / Movement
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ChevronRight",
  "ChevronDown",

  // Apps / Devices
  "Monitor",
  "Laptop",
  "Smartphone",
  "Tablet",
  "Server",
  "Cpu",
  "Wifi",

  // World / Globe
  "Globe",
  "Globe2",
  "Earth",
  "MapPin",
  "Languages",
] as const;

export interface IconPickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function IconPicker({
  value,
  onChange,
  placeholder = "Select an icon...",
  className,
}: IconPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  // Get the current icon component
  const CurrentIcon = value
    ? (LucideIcons[value as keyof typeof LucideIcons] as React.ComponentType<{
        className?: string;
      }>)
    : null;

  // Filter icons based on search
  const filteredIcons = React.useMemo(() => {
    if (!search.trim()) return ICON_LIST;
    const searchLower = search.toLowerCase();
    return ICON_LIST.filter((name) => name.toLowerCase().includes(searchLower));
  }, [search]);

  const handleSelect = (iconName: string) => {
    onChange(iconName);
    setOpen(false);
    setSearch("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onChange("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          {CurrentIcon ? (
            <div className="flex flex-1 items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-muted">
                <CurrentIcon className="h-4 w-4" />
              </div>
              <span className="text-sm">{value}</span>
            </div>
          ) : (
            <span className="flex-1">{placeholder}</span>
          )}
          {value && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleClear(e as unknown as React.MouseEvent);
                }
              }}
              className="rounded-sm opacity-50 hover:opacity-100 focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Clear icon</span>
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="border-b p-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search icons..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 pl-8"
            />
          </div>
        </div>
        <ScrollArea className="h-64">
          <div className="grid grid-cols-6 gap-1 p-3">
            {filteredIcons.map((iconName) => {
              const Icon = LucideIcons[
                iconName as keyof typeof LucideIcons
              ] as React.ComponentType<{ className?: string }>;
              if (!Icon) return null;

              const isSelected = value === iconName;

              return (
                <button
                  key={iconName}
                  type="button"
                  onClick={() => handleSelect(iconName)}
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-md transition-colors hover:bg-accent",
                    isSelected &&
                      "bg-primary text-primary-foreground hover:bg-primary/90"
                  )}
                  title={iconName}
                >
                  <Icon className="h-5 w-5" />
                </button>
              );
            })}
          </div>
          {filteredIcons.length === 0 && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No icons found
            </div>
          )}
        </ScrollArea>
        {value && (
          <div className="border-t p-2 text-center">
            <span className="text-xs text-muted-foreground">
              Selected:{" "}
              <span className="font-medium text-foreground">{value}</span>
            </span>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
