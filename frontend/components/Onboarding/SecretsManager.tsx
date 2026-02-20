"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Copy,
  Key,
  Plus,
  Trash2,
} from "lucide-react";
import { useState } from "react";

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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { adminFetch } from "@/lib/admin/api-client";

// =============================================================================
// Types
// =============================================================================

interface SyncSecret {
  id: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
  created_by_email: string | null;
}

interface CreateSecretResponse {
  id: string;
  name: string;
  secret: string;
  message: string;
}

// =============================================================================
// CopyButton
// =============================================================================

export function CopyButton({
  value,
  className,
  disabled,
}: {
  value: string;
  className?: string;
  disabled?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (disabled || !value) return;
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={className}
      onClick={handleCopy}
      disabled={disabled || !value}
    >
      {copied ? (
        <Check className="h-4 w-4 text-green-600" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </Button>
  );
}

// =============================================================================
// SecretsManager
// =============================================================================

interface SecretsManagerProps {
  productId: string;
  onSecretCreated: (secret: string, name: string) => void;
}

export function SecretsManager({ productId, onSecretCreated }: SecretsManagerProps) {
  const queryClient = useQueryClient();
  const [nameInput, setNameInput] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [keysOpen, setKeysOpen] = useState(false);

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
      setNameInput("");
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

  const handleCreate = () => {
    const name = nameInput.trim() || `key-${(secrets?.length ?? 0) + 1}`;
    if (name.length > 50) {
      setNameError("Name must be 50 characters or less");
      return;
    }
    createSecretMutation.mutate(name);
  };

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

  return (
    <div className="space-y-3">
      {canCreateMore && (
        <div className="flex gap-2">
          <Button
            onClick={handleCreate}
            disabled={createSecretMutation.isPending || isPending}
            className="shrink-0"
          >
            {createSecretMutation.isPending ? (
              <Spinner size="sm" className="mr-2" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Add API Key
          </Button>
          <Input
            placeholder="Optional name (e.g. production)"
            value={nameInput}
            onChange={(e) => {
              setNameInput(
                e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")
              );
              setNameError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
            }}
            className="font-mono h-9"
            disabled={isPending}
          />
        </div>
      )}

      {nameError && (
        <p className="text-xs text-destructive">{nameError}</p>
      )}

      {!canCreateMore && (
        <p className="text-xs text-muted-foreground">
          Maximum 10 keys. Revoke an existing key to create a new one.
        </p>
      )}

      {hasSecrets && (
        <Collapsible open={keysOpen} onOpenChange={setKeysOpen}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronDown
                className={cn(
                  "h-3 w-3 transition-transform duration-200",
                  keysOpen && "rotate-180"
                )}
              />
              {secrets.length} existing {secrets.length === 1 ? "key" : "keys"}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Last Used</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {secrets.map((secret) => (
                    <TableRow key={secret.id}>
                      <TableCell className="font-mono text-sm">
                        {secret.name}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(secret.created_at), {
                          addSuffix: true,
                        })}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {secret.last_used_at
                          ? formatDistanceToNow(new Date(secret.last_used_at), {
                              addSuffix: true,
                            })
                          : "Never"}
                      </TableCell>
                      <TableCell>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive h-7 w-7 p-0"
                              disabled={deleteSecretMutation.isPending}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Revoke Key</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to revoke &quot;
                                {secret.name}&quot;? Any CI/CD pipelines using
                                this key will fail to authenticate.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() =>
                                  deleteSecretMutation.mutate(secret.id)
                                }
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Revoke
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
