"use client";

/**
 * ApiKeysCard
 *
 * Custom inline card for managing API keys via the AI assistant.
 * Renders in the chat when the AI suggests managing API keys.
 *
 * Shows existing keys with delete functionality and allows creating
 * new keys. Runs in an isolated React root (no app context providers),
 * so uses adminFetch directly and getCurrentProductId() for context.
 */

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminFetch } from "@/lib/admin/api-client";
import { getCurrentProductId } from "@/lib/admin/api-client";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  Check,
  Copy,
  Key,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface CardComponentProps<T = Record<string, unknown>> {
  data: T;
  onConfirm: (modifiedData?: Record<string, unknown>) => void;
  onCancel: () => void;
}

interface ApiKeysCardData {
  auto_generate?: boolean;
  name?: string;
}

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

type CardState = "loading" | "ready" | "error";

export function ApiKeysCard({
  data,
  onConfirm,
  onCancel,
}: CardComponentProps<ApiKeysCardData>) {
  const productId = getCurrentProductId();

  const [secrets, setSecrets] = useState<SyncSecret[]>([]);
  const [cardState, setCardState] = useState<CardState>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  const [nameInput, setNameInput] = useState(data?.name ?? "");
  const [isCreating, setIsCreating] = useState(false);
  const autoGenerateTriggered = useRef(false);
  const [newlyCreatedSecret, setNewlyCreatedSecret] = useState<string | null>(
    null
  );
  const [newlyCreatedName, setNewlyCreatedName] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const fetchSecrets = useCallback(async () => {
    if (!productId) {
      setErrorMessage("No product selected");
      setCardState("error");
      return;
    }
    try {
      const data = await adminFetch<SyncSecret[]>(
        `/configs/${productId}/secrets/`
      );
      setSecrets(data);
      setCardState("ready");
    } catch {
      setErrorMessage("Failed to load API keys");
      setCardState("error");
    }
  }, [productId]);

  useEffect(() => {
    fetchSecrets();
  }, [fetchSecrets]);

  const handleCreate = useCallback(async (nameOverride?: string) => {
    if (!productId) return;
    const name =
      (nameOverride ?? nameInput.trim()) || `key-${(secrets?.length ?? 0) + 1}`;
    if (name.length > 50) return;

    setIsCreating(true);
    try {
      const result = await adminFetch<CreateSecretResponse>(
        `/configs/${productId}/secrets/`,
        { method: "POST", body: JSON.stringify({ name }) }
      );
      setNewlyCreatedSecret(result.secret);
      setNewlyCreatedName(result.name);
      setNameInput("");
      await fetchSecrets();
    } catch {
      setErrorMessage("Failed to create API key");
    } finally {
      setIsCreating(false);
    }
  }, [productId, nameInput, secrets?.length, fetchSecrets]);

  useEffect(() => {
    if (
      data?.auto_generate &&
      cardState === "ready" &&
      !autoGenerateTriggered.current
    ) {
      autoGenerateTriggered.current = true;
      handleCreate(data.name);
    }
  }, [data?.auto_generate, data?.name, cardState, handleCreate]);

  const handleDelete = useCallback(
    async (secretId: string) => {
      if (!productId) return;
      setDeletingId(secretId);
      try {
        await adminFetch(`/configs/${productId}/secrets/${secretId}/`, {
          method: "DELETE",
        });
        setSecrets((prev) => prev.filter((s) => s.id !== secretId));
        setConfirmDeleteId(null);
      } catch {
        setErrorMessage("Failed to revoke key");
      } finally {
        setDeletingId(null);
      }
    },
    [productId]
  );

  const handleCopy = useCallback((value: string) => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const handleDone = useCallback(() => {
    onConfirm({ managed: true, keyCount: secrets.length });
  }, [onConfirm, secrets.length]);

  if (cardState === "loading") {
    return (
      <div className="mt-3 w-full rounded-lg border bg-muted/30 p-6">
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <Spinner size="sm" />
          <span className="text-sm">Loading API keys...</span>
        </div>
      </div>
    );
  }

  if (cardState === "error" && secrets.length === 0) {
    return (
      <div className="mt-3 w-full rounded-lg border border-destructive/20 bg-destructive/10 p-4">
        <div className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-sm">{errorMessage}</span>
        </div>
        <div className="mt-3 flex justify-end">
          <Button variant="outline" size="sm" onClick={onCancel}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  const canCreateMore = secrets.length < 10;

  return (
    <div className="mt-3 w-full rounded-lg border bg-muted/30 p-4">
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <Key className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">API Keys</span>
        <span className="text-xs text-muted-foreground">
          ({secrets.length} key{secrets.length !== 1 ? "s" : ""})
        </span>
      </div>

      {/* Newly created secret banner */}
      {newlyCreatedSecret && (
        <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-amber-800 dark:text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5" />
            Copy your key now — it won&apos;t be shown again
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-amber-100 px-2 py-1 font-mono text-xs text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
              {newlyCreatedSecret}
            </code>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 shrink-0"
              onClick={() => handleCopy(newlyCreatedSecret)}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-green-600" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
          {newlyCreatedName && (
            <div className="mt-1 text-xs text-amber-700 dark:text-amber-400">
              Name: <span className="font-mono">{newlyCreatedName}</span>
            </div>
          )}
        </div>
      )}

      {/* Create new key */}
      {canCreateMore && (
        <div className="mb-3 flex gap-2">
          <Button
            onClick={() => handleCreate()}
            disabled={isCreating}
            size="sm"
            className="shrink-0"
          >
            {isCreating ? (
              <Spinner size="xs" className="mr-1.5" />
            ) : (
              <Plus className="mr-1.5 h-3.5 w-3.5" />
            )}
            Add Key
          </Button>
          <Input
            placeholder="Optional name (e.g. production)"
            value={nameInput}
            onChange={(e) =>
              setNameInput(
                e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")
              )
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
            }}
            className="h-8 font-mono text-xs"
            disabled={isCreating}
          />
        </div>
      )}
      {!canCreateMore && (
        <p className="mb-3 text-xs text-muted-foreground">
          Maximum 10 keys. Revoke an existing key to create a new one.
        </p>
      )}

      {/* Error banner */}
      {errorMessage && cardState !== "error" && (
        <div className="mb-3 rounded-md border border-destructive/20 bg-destructive/10 p-2 text-xs text-destructive">
          {errorMessage}
        </div>
      )}

      {/* Keys table */}
      {secrets.length > 0 ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Name</TableHead>
                <TableHead className="text-xs">Created</TableHead>
                <TableHead className="text-xs">Last Used</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {secrets.map((secret) => (
                <TableRow key={secret.id}>
                  <TableCell className="font-mono text-xs">
                    {secret.name}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(secret.created_at), {
                      addSuffix: true,
                    })}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {secret.last_used_at
                      ? formatDistanceToNow(new Date(secret.last_used_at), {
                          addSuffix: true,
                        })
                      : "Never"}
                  </TableCell>
                  <TableCell>
                    {confirmDeleteId === secret.id ? (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                          disabled={deletingId === secret.id}
                          onClick={() => handleDelete(secret.id)}
                        >
                          {deletingId === secret.id ? (
                            <Spinner size="xs" />
                          ) : (
                            <Check className="h-3 w-3" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => setConfirmDeleteId(null)}
                          disabled={deletingId === secret.id}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "h-7 w-7 p-0",
                          "text-muted-foreground hover:text-destructive"
                        )}
                        onClick={() => setConfirmDeleteId(secret.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
          No API keys yet. Create one above to get started.
        </div>
      )}

      {/* Footer actions */}
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleDone}>
          <Check className="mr-1 h-3.5 w-3.5" />
          Done
        </Button>
      </div>
    </div>
  );
}
