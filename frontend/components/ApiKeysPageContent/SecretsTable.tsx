"use client";

import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { adminFetch } from "@/lib/admin/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import type {
  CreateSecretResponse,
  SyncSecret,
} from "./ApiKeysPageContent.types";

interface SecretsTableProps {
  productId: string;
  onSecretCreated: (secret: string, name: string) => void;
}

export function SecretsTable({
  productId,
  onSecretCreated,
}: SecretsTableProps) {
  const queryClient = useQueryClient();
  const [newSecretName, setNewSecretName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);

  const {
    data: secrets,
    isPending,
    isError,
  } = useQuery({
    queryKey: ["sync-secrets", productId],
    queryFn: () => adminFetch<SyncSecret[]>(`/configs/${productId}/secrets/`),
    enabled: !!productId,
  });

  const createSecretMutation = useMutation({
    mutationFn: async (name: string) => {
      return adminFetch<CreateSecretResponse>(
        `/configs/${productId}/secrets/`,
        {
          method: "POST",
          body: JSON.stringify({ name }),
        }
      );
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["sync-secrets", productId] });
      queryClient.invalidateQueries({ queryKey: ["help-center-config"] });
      setNewSecretName("");
      setNameError(null);
      onSecretCreated(result.secret, result.name);
    },
    onError: (error: Error) => {
      setNameError(error.message || "Failed to create secret");
    },
  });

  const deleteSecretMutation = useMutation({
    mutationFn: async (secretId: string) => {
      return adminFetch(`/configs/${productId}/secrets/${secretId}/`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sync-secrets", productId] });
      queryClient.invalidateQueries({ queryKey: ["help-center-config"] });
    },
  });

  const validateName = (name: string): boolean => {
    if (!name.trim()) {
      setNameError("Name is required");
      return false;
    }
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(name.toLowerCase())) {
      setNameError("Use lowercase letters, numbers, and hyphens only");
      return false;
    }
    if (name.length > 50) {
      setNameError("Name must be 50 characters or less");
      return false;
    }
    setNameError(null);
    return true;
  };

  const handleCreateSecret = () => {
    const name = newSecretName.toLowerCase().trim();
    if (validateName(name)) {
      createSecretMutation.mutate(name);
    }
  };

  if (isPending) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          Failed to load secrets. Please try again.
        </AlertDescription>
      </Alert>
    );
  }

  const hasSecrets = secrets && secrets.length > 0;
  const canCreateMore = !secrets || secrets.length < 10;

  const secretColumns: DataTableColumn<SyncSecret>[] = [
    {
      id: "name",
      header: "Name",
      cell: (row) => <span className="font-mono text-sm">{row.name}</span>,
    },
    {
      id: "created",
      header: "Created",
      cell: (row) => (
        <span className="text-sm text-muted-foreground">
          {formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}
        </span>
      ),
    },
    {
      id: "last-used",
      header: "Last Used",
      cell: (row) => (
        <span className="text-sm text-muted-foreground">
          {row.last_used_at
            ? formatDistanceToNow(new Date(row.last_used_at), {
                addSuffix: true,
              })
            : "Never"}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      width: "w-12",
      cell: (row) => (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              disabled={deleteSecretMutation.isPending}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Revoke Secret</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to revoke the &quot;{row.name}&quot;
                secret? Any CI/CD pipelines using this secret will fail to
                authenticate.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteSecretMutation.mutate(row.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Revoke
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Sync Secrets</h3>
          <p className="text-xs text-muted-foreground">
            Create separate secrets for different environments (e.g.,
            production, staging)
          </p>
        </div>
      </div>

      {hasSecrets && (
        <DataTable
          columns={secretColumns}
          data={secrets}
          keyExtractor={(row) => row.id}
        />
      )}

      {canCreateMore && (
        <div className="rounded-lg border border-dashed p-4 space-y-3">
          <Label htmlFor="secret-name" className="text-sm font-medium">
            {hasSecrets ? "Add Another Secret" : "Create Your First Secret"}
          </Label>
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                id="secret-name"
                placeholder="e.g., production, staging, dev-ci"
                value={newSecretName}
                onChange={(e) => {
                  setNewSecretName(
                    e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")
                  );
                  setNameError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleCreateSecret();
                  }
                }}
                className="font-mono"
              />
              {nameError && (
                <p className="text-xs text-destructive mt-1">{nameError}</p>
              )}
            </div>
            <Button
              onClick={handleCreateSecret}
              disabled={createSecretMutation.isPending || !newSecretName.trim()}
            >
              {createSecretMutation.isPending ? (
                <Spinner size="sm" className="mr-2" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Generate
            </Button>
          </div>
        </div>
      )}

      {!canCreateMore && (
        <p className="text-xs text-muted-foreground">
          Maximum 10 secrets per product. Delete an existing secret to create a
          new one.
        </p>
      )}
    </div>
  );
}
