"use client";

import { ActionsSidebar } from "@/components/Actions";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProduct } from "@/providers";
import { actionListQuery } from "@/queries/actions.queries";
import type { Action, ActionType } from "@/types/actions";
import { ACTION_TYPE_LABELS, deriveActionLabel } from "@/types/actions";
import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useMemo } from "react";

interface ActionsLayoutProps {
  children: React.ReactNode;
}

/** Parse action ID from the pathname */
function parseActionId(pathname: string): string | null {
  const parts = pathname.replace(/\/$/, "").split("/");
  const actionsIndex = parts.indexOf("actions");
  if (actionsIndex === -1) return null;
  const id = parts[actionsIndex + 1] || null;
  if (id && ["new", "deployments"].includes(id)) return null;
  return id;
}

/** Group actions by type, preserving order */
function groupByType(actions: Action[]): [ActionType, Action[]][] {
  const map = new Map<ActionType, Action[]>();
  for (const action of actions) {
    const list = map.get(action.action_type) ?? [];
    list.push(action);
    map.set(action.action_type, list);
  }
  return Array.from(map.entries());
}

export default function ActionsLayout({ children }: ActionsLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { currentProduct } = useProduct();
  const currentActionId = parseActionId(pathname);

  const { data } = useQuery(
    actionListQuery({ product: currentProduct?.id })
  );
  const actions = useMemo(() => data?.results ?? [], [data?.results]);
  const grouped = useMemo(() => groupByType(actions), [actions]);

  return (
    <div className="relative flex h-full overflow-hidden">
      {/* Desktop sidebar - visible on wide containers */}
      <div className="hidden @[800px]/content:flex">
        <ActionsSidebar />
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile action switcher - visible on narrow containers */}
        <div className="shrink-0 border-b px-4 py-2.5 @[800px]/content:hidden">
          <Select
            value={currentActionId ?? ""}
            onValueChange={(id) => router.push(`/actions/${id}`)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select an action..." />
            </SelectTrigger>
            <SelectContent>
              {grouped.map(([type, typeActions]) => (
                <SelectGroup key={type}>
                  <SelectLabel className="text-xs font-medium text-muted-foreground">
                    {ACTION_TYPE_LABELS[type] ?? type}
                  </SelectLabel>
                  {typeActions.map((action) => (
                    <SelectItem key={action.id} value={action.id}>
                      {deriveActionLabel(action.name)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Content Panel */}
        <div className="flex-1 overflow-hidden bg-muted/30">{children}</div>
      </div>
    </div>
  );
}
