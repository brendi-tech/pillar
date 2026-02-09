"use client";

import { PersonaFormDialog } from "@/components/PersonaFormDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { WarningModal } from "@/components/WarningModal";
import type {
  AdminPersona,
  CreatePersonaPayload,
  UpdatePersonaPayload,
} from "@/lib/admin/personas.api";
import { renderLucideIcon } from "@/lib/utils";
import { Edit2, Plus, Trash2, User } from "lucide-react";
import { useState } from "react";

interface PersonaListProps {
  personas: AdminPersona[];
  onCreate: (data: CreatePersonaPayload) => Promise<void>;
  onUpdate: (id: string, data: UpdatePersonaPayload) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isLoading?: boolean;
}

export function PersonaList({
  personas,
  onCreate,
  onUpdate,
  onDelete,
  isLoading = false,
}: PersonaListProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingPersona, setEditingPersona] = useState<AdminPersona | null>(
    null
  );
  const [deletingPersona, setDeletingPersona] = useState<AdminPersona | null>(
    null
  );

  const handleCreate = async (
    data: CreatePersonaPayload | UpdatePersonaPayload
  ) => {
    await onCreate(data as CreatePersonaPayload);
    setShowCreateDialog(false);
  };

  const handleUpdate = async (
    data: CreatePersonaPayload | UpdatePersonaPayload
  ) => {
    if (!editingPersona) return;
    await onUpdate(editingPersona.id, data as UpdatePersonaPayload);
    setEditingPersona(null);
  };

  const handleDelete = async () => {
    if (!deletingPersona) return;
    await onDelete(deletingPersona.id);
    setDeletingPersona(null);
  };

  const sortedPersonas = [...personas].sort((a, b) => {
    // Sort by order first, then by name
    if (a.order !== b.order) {
      return a.order - b.order;
    }
    return a.name.localeCompare(b.name);
  });

  return (
    <>
      {sortedPersonas.length === 0 ? (
        <div className="py-12 text-center">
          <p className="mb-4 text-sm text-muted-foreground">
            No personas configured.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCreateDialog(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add your first persona
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedPersonas.map((persona) => (
            <Card
              key={persona.id}
              className="transition-colors hover:bg-accent/50"
            >
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
                      onClick={() => setEditingPersona(persona)}
                      disabled={isLoading}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeletingPersona(persona)}
                      disabled={isLoading}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <PersonaFormDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        persona={null}
        onSubmit={handleCreate}
        isLoading={isLoading}
      />

      {/* Edit Dialog */}
      <PersonaFormDialog
        open={!!editingPersona}
        onOpenChange={(open) => !open && setEditingPersona(null)}
        persona={editingPersona}
        onSubmit={handleUpdate}
        isLoading={isLoading}
      />

      {/* Delete Confirmation Dialog */}
      <WarningModal
        open={!!deletingPersona}
        onOpenChange={(open) => !open && setDeletingPersona(null)}
        onConfirm={handleDelete}
        title="Delete Persona"
        description={`Are you sure you want to delete "${deletingPersona?.name}"? This action cannot be undone.`}
        variant="delete"
        isLoading={isLoading}
      />
    </>
  );
}
