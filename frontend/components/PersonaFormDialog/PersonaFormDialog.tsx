"use client";

import { IconPicker } from "@/components/IconPicker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type {
  AdminPersona,
  CreatePersonaPayload,
  UpdatePersonaPayload,
} from "@/lib/admin/personas.api";
import { generateSlug } from "@/lib/utils";
import { useCallback, useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";

/**
 * Sanitize slug input while typing - allows dashes and converts spaces to dashes.
 * Less aggressive than generateSlug to allow typing dashes.
 */
function sanitizeSlugInput(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
}

interface PersonaFormData {
  name: string;
  slug: string;
  description: string;
  icon: string;
  is_active: boolean;
}

interface PersonaFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  persona?: AdminPersona | null;
  onSubmit: (
    data: CreatePersonaPayload | UpdatePersonaPayload
  ) => Promise<void>;
  isLoading: boolean;
}

export function PersonaFormDialog({
  open,
  onOpenChange,
  persona,
  onSubmit,
  isLoading,
}: PersonaFormDialogProps) {
  const isEdit = !!persona;

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors },
  } = useForm<PersonaFormData>({
    defaultValues: {
      name: "",
      slug: "",
      description: "",
      icon: "",
      is_active: true,
    },
  });

  // Track if slug has been manually edited by the user
  // Start as true when editing (so name changes don't overwrite existing slug)
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(isEdit);

  // Auto-generate slug from name if slug hasn't been manually edited
  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newName = e.target.value;
      // Only auto-update slug if user hasn't manually edited it
      if (!isSlugManuallyEdited) {
        setValue("slug", generateSlug(newName));
      }
    },
    [setValue, isSlugManuallyEdited]
  );

  // Handler for manual slug changes - marks as manually edited
  const handleSlugChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setIsSlugManuallyEdited(true);
      setValue("slug", sanitizeSlugInput(e.target.value));
    },
    [setValue]
  );

  // Reset form and slug edit state when dialog opens/closes
  useEffect(() => {
    if (open) {
      if (persona) {
        // Editing existing persona
        reset({
          name: persona.name,
          slug: persona.slug || "",
          description: persona.description || "",
          icon: persona.icon || "",
          is_active: persona.is_active,
        });
        setIsSlugManuallyEdited(true); // Don't auto-update when editing
      } else {
        // Creating new persona
        reset({
          name: "",
          slug: "",
          description: "",
          icon: "",
          is_active: true,
        });
        setIsSlugManuallyEdited(false); // Allow auto-update for new entries
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, persona?.id]);

  const onFormSubmit = async (data: PersonaFormData) => {
    await onSubmit({
      name: data.name.trim(),
      slug: data.slug.trim() || generateSlug(data.name),
      description: data.description.trim() || undefined,
      icon: data.icon.trim() || undefined,
      is_active: data.is_active,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit(onFormSubmit)}>
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit Persona" : "New Persona"}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Update the persona details below."
                : "Create a new persona for filtering knowledge content."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                type="text"
                {...register("name", {
                  required: "Please enter a persona name",
                  onChange: handleNameChange,
                })}
                placeholder="e.g., Administrators, Developers"
                autoFocus
                className="mt-1.5"
              />
              {errors.name && (
                <p className="mt-1 text-xs text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="slug">Slug</Label>
              <div className="mt-1.5 flex items-center gap-1 rounded-md border border-input bg-muted/50 px-3">
                <span className="text-sm text-muted-foreground">/</span>
                <Input
                  id="slug"
                  type="text"
                  {...register("slug", {
                    required: "Please enter a slug",
                    onChange: handleSlugChange,
                  })}
                  placeholder="administrators"
                  className="border-0 bg-transparent px-0 focus-visible:ring-0"
                />
              </div>
              {errors.slug ? (
                <p className="mt-1 text-xs text-destructive">
                  {errors.slug.message}
                </p>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">
                  URL-friendly identifier (auto-generated from name)
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                {...register("description")}
                rows={3}
                className="mt-1.5"
                placeholder="Brief description of this persona..."
              />
            </div>
            <div>
              <Label>Icon</Label>
              <Controller
                name="icon"
                control={control}
                render={({ field }) => (
                  <IconPicker
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Select an icon..."
                  />
                )}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Choose an icon to represent this persona (optional)
              </p>
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="is-active">Active</Label>
                <p className="text-xs text-muted-foreground">
                  Only active personas are shown to users
                </p>
              </div>
              <Controller
                name="is_active"
                control={control}
                render={({ field }) => (
                  <Switch
                    id="is-active"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading
                ? "Saving..."
                : isEdit
                  ? "Save Changes"
                  : "Create Persona"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
