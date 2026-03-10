"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, Mail, Pencil, X } from "lucide-react";
import { updateOrganizationMutation } from "@/queries/organization.queries";
import { useAuth } from "@/providers/AuthProvider";
import { useOrganization } from "@/providers/OrganizationProvider";
import { toast } from "sonner";

export function BillingEmailRow() {
  const { refreshUser } = useAuth();
  const { currentOrganization } = useOrganization();
  const [isEditing, setIsEditing] = useState(false);
  const [emailDraft, setEmailDraft] = useState("");

  const updateOrg = useMutation({
    ...updateOrganizationMutation(),
    onSuccess: () => {
      refreshUser();
      setIsEditing(false);
      toast.success("Billing email updated");
    },
  });

  const handleSave = () => {
    if (!currentOrganization) return;
    updateOrg.mutate({
      id: currentOrganization.id,
      data: { billing_email: emailDraft || null },
    });
  };

  const handleStartEditing = () => {
    setEmailDraft(currentOrganization?.billing_email || "");
    setIsEditing(true);
  };

  return (
    <div className="flex items-center justify-between rounded-lg border px-4 py-3">
      <div className="flex items-center gap-2 text-sm">
        <Mail className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">Billing Email</span>
      </div>
      {isEditing ? (
        <div className="flex items-center gap-1.5">
          <Input
            type="email"
            value={emailDraft}
            onChange={(e) => setEmailDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") setIsEditing(false);
            }}
            placeholder="billing@company.com"
            className="h-7 w-56 text-sm"
            autoFocus
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={updateOrg.isPending}
            onClick={handleSave}
          >
            <Check className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setIsEditing(false)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          className="group flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          onClick={handleStartEditing}
        >
          <span>{currentOrganization?.billing_email || "Not set"}</span>
          <Pencil className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
        </button>
      )}
    </div>
  );
}
