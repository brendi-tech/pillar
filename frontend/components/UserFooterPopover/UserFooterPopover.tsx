"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { AdminProduct } from "@/types/admin";
import {
  Check,
  ChevronDown,
  LogOut,
  Moon,
  Pencil,
  Plus,
  Sun,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface User {
  name: string;
  email: string;
  avatar?: string;
}

interface UserFooterPopoverProps {
  user: User;
  currentProduct: AdminProduct | null;
  availableProducts: AdminProduct[];
  isLoadingProducts: boolean;
  switchProduct: (id: string) => void;
  setEditingProduct: (product: AdminProduct | null) => void;
  theme: string | undefined;
  setTheme: (theme: string) => void;
}

export function UserFooterPopover({
  user,
  currentProduct,
  availableProducts,
  isLoadingProducts,
  switchProduct,
  setEditingProduct,
  theme,
  setTheme,
}: UserFooterPopoverProps) {
  const router = useRouter();
  const [footerPopoverOpen, setFooterPopoverOpen] = useState(false);

  const userInitials = user.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
    <Popover open={footerPopoverOpen} onOpenChange={setFooterPopoverOpen} modal>
      <PopoverTrigger asChild>
        <button className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-sm font-medium text-foreground transition-colors hover:bg-sidebar-accent">
          <div className="flex items-center gap-2 min-w-0">
            <Avatar className="h-7 w-7">
              <AvatarImage src={user.avatar} alt={user.name} />
              <AvatarFallback className="bg-linear-to-br from-primary to-primary/80 text-primary-foreground text-xs font-bold">
                {userInitials}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col items-start min-w-0">
              <span className="truncate text-sm font-medium leading-tight">
                {user.name}
              </span>
              <span className="truncate text-xs text-muted-foreground leading-tight">
                {isLoadingProducts
                  ? "Loading..."
                  : currentProduct?.name || "Select Assistant"}
              </span>
            </div>
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 p-1.5 sm:p-1"
        align="start"
        side="top"
        sideOffset={4}
      >
        {/* User Info Header */}
        <div className="px-3 py-3 sm:px-2 sm:py-2 border-b border-sidebar-border mb-1">
          <p className="text-base sm:text-sm font-medium text-foreground truncate">
            {user.name}
          </p>
          <p className="text-sm sm:text-xs text-muted-foreground truncate">
            {user.email}
          </p>
        </div>

        {/* Assistant Switcher Section */}
        {availableProducts.length > 0 && (
          <>
            <div className="px-3 py-2 sm:px-2 sm:py-1.5">
              <span className="text-xs sm:text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Assistant
              </span>
            </div>
            <div className="max-h-48 sm:max-h-40 overflow-y-auto">
              {availableProducts.map((hc) => (
                <div key={hc.id} className="flex items-center rounded-md">
                  <button
                    onClick={() => {
                      switchProduct(hc.id);
                      setFooterPopoverOpen(false);
                      router.push("/knowledge");
                    }}
                    className={cn(
                      "flex flex-1 min-w-0 items-center gap-3 sm:gap-2 rounded-md px-3 py-3 sm:px-2 sm:py-1.5 text-base sm:text-sm transition-colors",
                      currentProduct?.id === hc.id
                        ? "bg-sidebar-accent text-foreground"
                        : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                    )}
                  >
                    <div className="flex h-7 w-7 sm:h-5 sm:w-5 items-center justify-center rounded bg-linear-to-br from-primary to-primary/80 text-primary-foreground text-sm sm:text-xs font-bold shrink-0">
                      {hc.name.charAt(0)}
                    </div>
                    <span className="flex-1 truncate text-left">{hc.name}</span>
                    {currentProduct?.id === hc.id && (
                      <Check className="h-5 w-5 sm:h-4 sm:w-4 text-primary shrink-0" />
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingProduct(hc);
                      setFooterPopoverOpen(false);
                    }}
                    className="flex h-10 w-10 sm:h-5 sm:w-5 items-center justify-center rounded shrink-0 mr-1"
                  >
                    <Pencil className="h-4 w-4 sm:h-3 sm:w-3 text-muted-foreground" />
                  </button>
                </div>
              ))}
            </div>
            {/* New Assistant Link */}
            <Link
              href="/onboarding?new=true"
              onClick={() => setFooterPopoverOpen(false)}
              className="flex w-full items-center gap-3 sm:gap-2 rounded-md px-3 py-3 sm:px-2 sm:py-1.5 text-base sm:text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
            >
              <div className="flex h-7 w-7 sm:h-5 sm:w-5 items-center justify-center rounded border border-dashed border-muted-foreground/50">
                <Plus className="h-4 w-4 sm:h-3 sm:w-3" />
              </div>
              <span>New Assistant</span>
            </Link>
            <div className="border-t border-sidebar-border my-1.5 sm:my-1" />
          </>
        )}

        {/* Actions Section */}
        <div className="space-y-1 sm:space-y-0.5">
          {/* Theme Toggle */}
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="flex w-full items-center gap-3 sm:gap-2 rounded-md px-3 py-3 sm:px-2 sm:py-1.5 text-base sm:text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
          >
            {theme === "dark" ? (
              <Sun className="h-5 w-5 sm:h-4 sm:w-4" />
            ) : (
              <Moon className="h-5 w-5 sm:h-4 sm:w-4" />
            )}
            <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
          </button>

          {/* Sign Out */}
          <button
            onClick={() => {
              setFooterPopoverOpen(false);
              router.push("/logout");
            }}
            className="flex w-full items-center gap-3 sm:gap-2 rounded-md px-3 py-3 sm:px-2 sm:py-1.5 text-base sm:text-sm text-rose-600 transition-colors hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-900/20"
          >
            <LogOut className="h-5 w-5 sm:h-4 sm:w-4" />
            <span>Sign out</span>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
