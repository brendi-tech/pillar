"use client";

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
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/providers/AuthProvider";
import { useOrganization } from "@/providers/OrganizationProvider";
import { createOrganizationMutation } from "@/queries/organization.queries";
import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";

interface CreateOrganizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOrgCreated: (orgId: string) => void;
}

export function CreateOrganizationDialog({
  open,
  onOpenChange,
  onOrgCreated,
}: CreateOrganizationDialogProps) {
  const { refreshUser } = useAuth();
  const { setCurrentOrganizationId } = useOrganization();
  const [orgName, setOrgName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const createOrg = useMutation({
    ...createOrganizationMutation(),
    onSuccess: async (newOrg) => {
      setCurrentOrganizationId(newOrg.id);
      await refreshUser();
      onOpenChange(false);
      setOrgName("");
      onOrgCreated(newOrg.id);
    },
  });

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
    if (!newOpen) {
      setOrgName("");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (orgName.trim()) {
      createOrg.mutate({ name: orgName.trim() });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>Create New Organization</DialogTitle>
          <DialogDescription>
            Organizations let you manage separate teams, billing, and
            assistants.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="org-name">Name</Label>
              <Input
                ref={inputRef}
                id="org-name"
                placeholder="My Organization"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                disabled={createOrg.isPending}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createOrg.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!orgName.trim() || createOrg.isPending}
            >
              {createOrg.isPending ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Creating...
                </>
              ) : (
                "Create"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
