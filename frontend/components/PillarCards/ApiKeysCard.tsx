"use client";

/**
 * ApiKeysCard
 *
 * Manages API keys (sync secrets) for the current project.
 * Rendered inside the ApiKeysModal dialog. Uses adminFetch directly
 * and getCurrentProductId() for context (no app context providers needed).
 */

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { adminFetch, getCurrentProductId } from "@/lib/admin/api-client";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  Check,
  Copy,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface CardComponentProps<T = Record<string, unknown>> {
  data: T;
  onConfirm?: (modifiedData?: Record<string, unknown>) => void;
  onCancel?: () => void;
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

function truncateKey(key: string): string {
  if (key.length <= 20) return key;
  return `${key.slice(0, 12)}${"•".repeat(8)}${key.slice(-8)}`;
}

export function ApiKeysCard({
  data,
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
  const [showFullKey, setShowFullKey] = useState(false);

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

  const handleCreate = useCallback(
    async (nameOverride?: string) => {
      if (!productId) return;
      const name =
        (nameOverride ?? nameInput.trim()) ||
        `key-${(secrets?.length ?? 0) + 1}`;
      if (name.length > 50) return;

      setIsCreating(true);
      setErrorMessage("");
      try {
        const result = await adminFetch<CreateSecretResponse>(
          `/configs/${productId}/secrets/`,
          { method: "POST", body: JSON.stringify({ name }) }
        );
        setNewlyCreatedSecret(result.secret);
        setNewlyCreatedName(result.name);
        setShowFullKey(false);
        setCopied(false);
        setNameInput("");
        await fetchSecrets();
      } catch {
        setErrorMessage("Failed to create API key");
      } finally {
        setIsCreating(false);
      }
    },
    [productId, nameInput, secrets?.length, fetchSecrets]
  );

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

  if (cardState === "loading") {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
        <Spinner size="sm" />
        <span className="text-sm">Loading API keys...</span>
      </div>
    );
  }

  if (cardState === "error" && secrets.length === 0) {
    return (
      <div className="rounded-md border border-destructive/20 bg-destructive/5 p-4">
        <div className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="text-sm">{errorMessage}</span>
        </div>
      </div>
    );
  }

  const canCreateMore = secrets.length < 10;

  return (
    <div className="w-full space-y-4">
      {/* Newly created secret */}
      {newlyCreatedSecret && (
        <div className="rounded-lg border border-amber-300/60 bg-amber-50/80 dark:border-amber-700/40 dark:bg-amber-950/20">
          <div className="flex items-center gap-2 border-b border-amber-200/60 px-4 py-2.5 dark:border-amber-800/30">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
            <span className="text-xs font-medium text-amber-800 dark:text-amber-300">
              Copy this key now — it won&apos;t be shown again
            </span>
          </div>
          <div className="px-4 py-3">
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 select-all break-all rounded-md bg-amber-100/80 px-3 py-2 font-mono text-[13px] leading-relaxed text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
                {showFullKey
                  ? newlyCreatedSecret
                  : truncateKey(newlyCreatedSecret)}
              </code>
              <div className="flex shrink-0 gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-8 w-8 p-0",
                    copied &&
                      "border-green-300 bg-green-50 text-green-600 dark:border-green-700 dark:bg-green-950/30"
                  )}
                  onClick={() => handleCopy(newlyCreatedSecret)}
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setShowFullKey((v) => !v)}
                >
                  {showFullKey ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>
            {newlyCreatedName && (
              <p className="mt-2 text-xs text-amber-700/80 dark:text-amber-400/80">
                Label: <span className="font-medium">{newlyCreatedName}</span>
              </p>
            )}
          </div>
        </div>
      )}

      {/* Error banner */}
      {errorMessage && cardState !== "error" && (
        <div className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
          {errorMessage}
        </div>
      )}

      {/* Keys list */}
      {secrets.length > 0 ? (
        <div className="divide-y rounded-lg border">
          {secrets.map((secret) => (
            <div
              key={secret.id}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate font-mono text-sm font-medium">
                  {secret.name}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Created{" "}
                  {formatDistanceToNow(new Date(secret.created_at), {
                    addSuffix: true,
                  })}
                  {secret.last_used_at && (
                    <>
                      {" · "}Last used{" "}
                      {formatDistanceToNow(new Date(secret.last_used_at), {
                        addSuffix: true,
                      })}
                    </>
                  )}
                </p>
              </div>
              <div className="shrink-0">
                {confirmDeleteId === secret.id ? (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                      disabled={deletingId === secret.id}
                      onClick={() => handleDelete(secret.id)}
                    >
                      {deletingId === secret.id ? (
                        <Spinner size="xs" />
                      ) : (
                        "Revoke"
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => setConfirmDeleteId(null)}
                      disabled={deletingId === secret.id}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => setConfirmDeleteId(secret.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
          No API keys yet
        </div>
      )}

      {/* Create new key */}
      {canCreateMore && (
        <div className="flex items-center gap-2">
          <Input
            placeholder="Key label (e.g. production)"
            value={nameInput}
            onChange={(e) =>
              setNameInput(
                e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")
              )
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
            }}
            className="font-mono text-sm"
            disabled={isCreating}
          />
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
            Create
          </Button>
        </div>
      )}
      {!canCreateMore && (
        <p className="text-xs text-muted-foreground">
          Maximum 10 keys reached. Revoke an existing key to create a new one.
        </p>
      )}
    </div>
  );
}
