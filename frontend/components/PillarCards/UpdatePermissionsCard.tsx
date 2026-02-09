"use client";

/**
 * UpdatePermissionsCard
 *
 * Custom confirmation card for updating user permissions via the AI assistant.
 * Renders inline in the chat when the AI suggests changing resource permissions.
 */

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Check, Loader2, X, Shield } from "lucide-react";
import { useState, useCallback } from "react";
import {
  getGlobalPermissions,
  getGlobalUpdatePermission,
  type Resource,
  type PermissionLevel,
} from "@/components/TeamPermissionsPanel";

interface CardComponentProps<T = Record<string, unknown>> {
  data: T;
  onConfirm: (modifiedData?: Record<string, unknown>) => void;
  onCancel: () => void;
}

interface UpdatePermissionsData {
  userName: string;
  resource: Resource;
  level: PermissionLevel;
  card_type: string;
}

type CardState = "idle" | "loading" | "success" | "error";

const RESOURCES: { value: Resource; label: string }[] = [
  { value: "production", label: "Production" },
  { value: "staging", label: "Staging" },
  { value: "analytics", label: "Analytics" },
  { value: "billing", label: "Billing" },
  { value: "team", label: "Team" },
];

const PERMISSION_LEVELS: { value: PermissionLevel; label: string }[] = [
  { value: "none", label: "None" },
  { value: "view", label: "View" },
  { value: "edit", label: "Edit" },
  { value: "admin", label: "Admin" },
];

export function UpdatePermissionsCard({
  data,
  onConfirm,
  onCancel,
}: CardComponentProps<UpdatePermissionsData>) {
  const [resource, setResource] = useState<Resource>(data.resource || "production");
  const [level, setLevel] = useState<PermissionLevel>(data.level || "view");
  const [cardState, setCardState] = useState<CardState>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Find user from global state
  const users = getGlobalPermissions();
  const user = users.find(
    (u) =>
      u.name.toLowerCase().includes(data.userName?.toLowerCase() || "") ||
      u.email.toLowerCase().includes(data.userName?.toLowerCase() || "")
  );

  const handleConfirm = useCallback(() => {
    if (!user) {
      setErrorMessage(`User "${data.userName}" not found`);
      setCardState("error");
      return;
    }

    setCardState("loading");
    setErrorMessage("");

    const updateFn = getGlobalUpdatePermission();
    if (updateFn) {
      updateFn(user.id, resource, level);
    }

    setCardState("success");
    toast.success(`Updated ${user.name}'s permissions`, {
      description: `${resource} access set to ${level}`,
    });

    setTimeout(() => {
      onConfirm({ userName: user.name, userId: user.id, resource, level });
    }, 100);
  }, [user, resource, level, data.userName, onConfirm]);

  // Success state
  if (cardState === "success") {
    return (
      <div className="mt-3 w-full rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950/30">
        <div className="flex items-center justify-center gap-2 text-green-700 dark:text-green-400">
          <Check className="h-5 w-5" />
          <span className="font-medium">
            {user?.name}&apos;s {resource} access set to {level}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 w-full rounded-lg border bg-muted/30 p-4">
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <Shield className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Update Permissions</span>
      </div>

      {/* User Info */}
      <div className="mb-4 rounded-md bg-background/50 p-3">
        <p className="text-sm">
          <span className="text-muted-foreground">User:</span>{" "}
          <span className="font-medium">{user?.name || data.userName}</span>
          {user && (
            <span className="ml-2 text-xs text-muted-foreground">
              ({user.email})
            </span>
          )}
        </p>
        {!user && data.userName && (
          <p className="mt-1 text-xs text-destructive">
            User not found in current session
          </p>
        )}
      </div>

      {/* Resource Selector */}
      <div className="mb-4">
        <Label className="mb-2 block text-xs text-muted-foreground">
          Resource
        </Label>
        <Select
          value={resource}
          onValueChange={(value) => setResource(value as Resource)}
          disabled={cardState === "loading"}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select resource" />
          </SelectTrigger>
          <SelectContent>
            {RESOURCES.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Permission Level Selector */}
      <div className="mb-4">
        <Label className="mb-2 block text-xs text-muted-foreground">
          Permission Level
        </Label>
        <Select
          value={level}
          onValueChange={(value) => setLevel(value as PermissionLevel)}
          disabled={cardState === "loading"}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select level" />
          </SelectTrigger>
          <SelectContent>
            {PERMISSION_LEVELS.map((l) => (
              <SelectItem key={l.value} value={l.value}>
                {l.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Error message */}
      {cardState === "error" && errorMessage && (
        <div className="mb-4 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          {errorMessage}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={cardState === "loading"}
        >
          <X className="mr-1 h-3.5 w-3.5" />
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleConfirm}
          disabled={cardState === "loading" || !user}
        >
          {cardState === "loading" ? (
            <>
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              Updating...
            </>
          ) : (
            <>
              <Check className="mr-1 h-3.5 w-3.5" />
              Update Permissions
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
