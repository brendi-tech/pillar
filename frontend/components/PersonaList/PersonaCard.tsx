"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { AdminPersona } from "@/lib/admin/personas.api";
import { renderLucideIcon } from "@/lib/utils";
import { Edit2, Trash2, User } from "lucide-react";

export interface PersonaCardProps {
  persona: AdminPersona;
  onEdit: (persona: AdminPersona) => void;
  onDelete: (persona: AdminPersona) => void;
  disabled?: boolean;
}

export function PersonaCard({
  persona,
  onEdit,
  onDelete,
  disabled = false,
}: PersonaCardProps) {
  return (
    <Card className="transition-colors hover:bg-accent/50">
      <CardContent>
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
            {renderLucideIcon(
              persona.icon,
              "h-5 w-5 text-muted-foreground"
            ) || <User className="h-5 w-5 text-muted-foreground" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <h3 className="text-sm font-medium">{persona.name}</h3>
              {!persona.is_active && (
                <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  Inactive
                </span>
              )}
            </div>
            {persona.description && (
              <p className="line-clamp-2 text-xs text-muted-foreground">
                {persona.description}
              </p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              Slug:{" "}
              <code className="rounded bg-muted px-1 py-0.5">
                {persona.slug}
              </code>
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onEdit(persona)}
              disabled={disabled}
            >
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onDelete(persona)}
              disabled={disabled}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
