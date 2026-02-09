"use client";

/**
 * InviteMembersCard
 *
 * Custom confirmation card for inviting team members via the AI assistant.
 * Renders inline in the chat when the AI suggests inviting users.
 *
 * Receives data from the AI with emails and role, allows the user to
 * modify the list, then submits to the invite API on confirmation.
 */

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Check, Loader2, X, Mail, UserPlus, Plus } from "lucide-react";

// Card component props for custom action cards
interface CardComponentProps<T = Record<string, unknown>> {
  data: T;
  onConfirm: (modifiedData?: Record<string, unknown>) => void;
  onCancel: () => void;
  onStateChange?: (state: 'loading' | 'success' | 'error', message?: string) => void;
}
import { useState, useCallback, useRef } from "react";
import { getCurrentOrganizationId } from "@/lib/admin/api-client";
import { organizationAPI } from "@/lib/admin/organization-api";

interface InviteMembersData {
  emails: string[];
  role: "admin" | "member";
  card_type: string;
}

type CardState = "idle" | "loading" | "success" | "error";

export function InviteMembersCard({
  data,
  onConfirm,
  onCancel,
}: CardComponentProps<InviteMembersData>) {
  // Note: We use getCurrentOrganizationId() instead of useOrganization() because
  // this component is rendered in an isolated React tree via the Pillar SDK's
  // createRoot(), which doesn't have access to the app's React context providers.
  const currentOrganizationId = getCurrentOrganizationId();

  // Local state for editing
  const [emails, setEmails] = useState<string[]>(data.emails || []);
  const [role, setRole] = useState<"admin" | "member">(data.role || "member");
  const [cardState, setCardState] = useState<CardState>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [successCount, setSuccessCount] = useState(0);
  const [emailInput, setEmailInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Clear error state when user makes changes
  const clearErrorIfNeeded = useCallback(() => {
    if (cardState === "error") {
      setCardState("idle");
      setErrorMessage("");
    }
  }, [cardState]);

  const removeEmail = useCallback((emailToRemove: string) => {
    setEmails((prev) => prev.filter((e) => e !== emailToRemove));
    clearErrorIfNeeded();
  }, [clearErrorIfNeeded]);

  const addEmail = useCallback(() => {
    const trimmed = emailInput.trim().toLowerCase();
    // Basic email validation
    if (trimmed && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      if (!emails.includes(trimmed)) {
        setEmails((prev) => [...prev, trimmed]);
      }
      setEmailInput("");
      inputRef.current?.focus();
      clearErrorIfNeeded();
    }
  }, [emailInput, emails, clearErrorIfNeeded]);

  const handleInputKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addEmail();
    }
  }, [addEmail]);

  const handleConfirm = useCallback(async () => {
    // Auto-add pending email from input field if valid
    let finalEmails = [...emails];
    const trimmedInput = emailInput.trim().toLowerCase();
    if (trimmedInput && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedInput)) {
      if (!finalEmails.includes(trimmedInput)) {
        finalEmails = [...finalEmails, trimmedInput];
        setEmails(finalEmails);
        setEmailInput("");
      }
    }

    if (finalEmails.length === 0) return;

    setCardState("loading");
    setErrorMessage("");

    try {
      // Get the organization ID from context
      if (!currentOrganizationId) {
        throw new Error("No organization found");
      }

      // Call the bulk invite API (uses apiClient which handles base URL)
      const result = await organizationAPI.bulkInviteMembers(
        currentOrganizationId,
        finalEmails,
        role
      );

      const successfulCount = result.successful?.length || 0;

      if (successfulCount > 0) {
        setSuccessCount(successfulCount);
        setCardState("success");
        toast.success("Invitations sent!", {
          description: `Successfully invited ${successfulCount} team member${successfulCount > 1 ? "s" : ""}.`,
        });
        // Delay onConfirm to ensure React renders success state first
        // The onConfirm emits a task:execute event but the invites are already sent
        setTimeout(() => {
          onConfirm({ emails: finalEmails, role });
        }, 100);
      } else if (result.skipped?.length > 0) {
        // All were skipped (already invited/members)
        setErrorMessage(
          `All emails were skipped: ${result.skipped.map((s: { reason: string }) => s.reason).join(", ")}`
        );
        setCardState("error");
      } else {
        throw new Error("No invitations were sent");
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to send invitations"
      );
      setCardState("error");
    }
  }, [emails, emailInput, role, currentOrganizationId, onConfirm]);

  // Success state
  if (cardState === "success") {
    return (
      <div className="mt-3 w-full rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950/30">
        <div className="flex items-center justify-center gap-2 text-green-700 dark:text-green-400">
          <Check className="h-5 w-5" />
          <span className="font-medium">
            {successCount} invitation{successCount > 1 ? "s" : ""} sent
            successfully!
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 w-full rounded-lg border bg-muted/30 p-4">
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <UserPlus className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Invite Team Members</span>
      </div>

      {/* Emails list */}
      <div className="mb-4">
        <Label className="mb-2 block text-xs text-muted-foreground">
          Emails to invite
        </Label>
        <div className="flex flex-wrap gap-2 rounded-md border bg-background p-3">
          {emails.map((email) => (
            <Badge
              key={email}
              variant="secondary"
              className="flex items-center gap-1.5 py-1 pl-2 pr-1"
            >
              <Mail className="h-3 w-3" />
              {email}
              <button
                type="button"
                onClick={() => removeEmail(email)}
                className="rounded-full p-0.5 hover:bg-destructive/20"
                disabled={cardState === "loading"}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {/* Add email input */}
          <div className="flex items-center gap-1">
            <Input
              ref={inputRef}
              type="email"
              placeholder="Add email..."
              value={emailInput}
              onChange={(e) => {
                setEmailInput(e.target.value);
                clearErrorIfNeeded();
              }}
              onKeyDown={handleInputKeyDown}
              className="h-7 w-40 text-xs"
              disabled={cardState === "loading"}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={addEmail}
              disabled={cardState === "loading" || !emailInput.trim()}
              className="h-7 px-2"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Role selector */}
      <div className="mb-4">
        <Label className="mb-2 block text-xs text-muted-foreground">Role</Label>
        <select
          value={role}
          onChange={(e) => {
            setRole(e.target.value as "admin" | "member");
            clearErrorIfNeeded();
          }}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          disabled={cardState === "loading"}
        >
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
        <p className="mt-1 text-xs text-muted-foreground">
          Admins can manage users and settings. Members can use the product.
        </p>
      </div>

      {/* Error message */}
      {cardState === "error" && errorMessage && (
        <div className="mb-4 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          <div>{errorMessage}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Update the email address and try again.
          </div>
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
          disabled={
            cardState === "loading" ||
            (emails.length === 0 &&
              !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.trim()))
          }
        >
          {cardState === "loading" ? (
            <>
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Check className="mr-1 h-3.5 w-3.5" />
              {(() => {
                // Count including pending email input
                const pendingEmail = emailInput.trim();
                const hasPendingValidEmail =
                  pendingEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pendingEmail) && !emails.includes(pendingEmail.toLowerCase());
                const totalCount = emails.length + (hasPendingValidEmail ? 1 : 0);
                return totalCount === 0
                  ? "Invite"
                  : totalCount === 1
                    ? "Invite 1 Member"
                    : `Invite ${totalCount} Members`;
              })()}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
