'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import {
  Copy,
  Check,
  Code2,
  ExternalLink,
  Tag,
  ChevronDown,
  Server,
  AlertTriangle,
  Plus,
  Trash2,
  Loader2,
} from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
} from '@/components/ui/alert-dialog';
import { useProduct } from '@/providers/ProductProvider';
import { adminFetch } from '@/lib/admin/api-client';

interface ActionSyncModalProps {
  trigger?: React.ReactNode;
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

function CopyButton({ value, className, disabled }: { value: string; className?: string; disabled?: boolean }) {
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

interface SecretsTableProps {
  productId: string;
  onSecretCreated: (secret: string, name: string) => void;
}

function SecretsTable({ productId, onSecretCreated }: SecretsTableProps) {
  const queryClient = useQueryClient();
  const [newSecretName, setNewSecretName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);

  const { data: secrets, isPending, isError } = useQuery({
    queryKey: ['sync-secrets', productId],
    queryFn: () => adminFetch<SyncSecret[]>(`/configs/${productId}/secrets/`),
    enabled: !!productId,
  });

  const createSecretMutation = useMutation({
    mutationFn: async (name: string) => {
      return adminFetch<CreateSecretResponse>(`/configs/${productId}/secrets/`, {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['sync-secrets', productId] });
      queryClient.invalidateQueries({ queryKey: ['help-center-config'] });
      setNewSecretName('');
      setNameError(null);
      onSecretCreated(result.secret, result.name);
    },
    onError: (error: Error) => {
      setNameError(error.message || 'Failed to create secret');
    },
  });

  const deleteSecretMutation = useMutation({
    mutationFn: async (secretId: string) => {
      return adminFetch(`/configs/${productId}/secrets/${secretId}/`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sync-secrets', productId] });
      queryClient.invalidateQueries({ queryKey: ['help-center-config'] });
    },
  });

  const validateName = (name: string): boolean => {
    if (!name.trim()) {
      setNameError('Name is required');
      return false;
    }
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(name.toLowerCase())) {
      setNameError('Use lowercase letters, numbers, and hyphens only');
      return false;
    }
    if (name.length > 50) {
      setNameError('Name must be 50 characters or less');
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
        <AlertDescription>Failed to load secrets. Please try again.</AlertDescription>
      </Alert>
    );
  }

  const hasSecrets = secrets && secrets.length > 0;
  const canCreateMore = !secrets || secrets.length < 10;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Sync Secrets</h3>
          <p className="text-xs text-muted-foreground">
            Create separate secrets for different environments (e.g., production, staging)
          </p>
        </div>
      </div>

      {/* Existing secrets table */}
      {hasSecrets && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last Used</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {secrets.map((secret) => (
                <TableRow key={secret.id}>
                  <TableCell className="font-mono text-sm">{secret.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(secret.created_at), { addSuffix: true })}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {secret.last_used_at
                      ? formatDistanceToNow(new Date(secret.last_used_at), { addSuffix: true })
                      : 'Never'}
                  </TableCell>
                  <TableCell>
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
                            Are you sure you want to revoke the &quot;{secret.name}&quot; secret? Any CI/CD pipelines
                            using this secret will fail to authenticate.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteSecretMutation.mutate(secret.id)}
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
      )}

      {/* Create new secret */}
      {canCreateMore && (
        <div className="rounded-lg border border-dashed p-4 space-y-3">
          <Label htmlFor="secret-name" className="text-sm font-medium">
            {hasSecrets ? 'Add Another Secret' : 'Create Your First Secret'}
          </Label>
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                id="secret-name"
                placeholder="e.g., production, staging, dev-ci"
                value={newSecretName}
                onChange={(e) => {
                  setNewSecretName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                  setNameError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateSecret();
                  }
                }}
                className="font-mono"
              />
              {nameError && <p className="text-xs text-destructive mt-1">{nameError}</p>}
            </div>
            <Button
              onClick={handleCreateSecret}
              disabled={createSecretMutation.isPending || !newSecretName.trim()}
            >
              {createSecretMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
          Maximum 10 secrets per product. Delete an existing secret to create a new one.
        </p>
      )}
    </div>
  );
}

export function ActionSyncModal({ trigger }: ActionSyncModalProps) {
  const { currentProduct: config, isLoading } = useProduct();
  const [open, setOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  // Newly generated secret - shown once then cleared
  const [newlyGeneratedSecret, setNewlyGeneratedSecret] = useState<{
    secret: string;
    name: string;
  } | null>(null);

  // Clear the secret when modal closes (security - only shown once)
  useEffect(() => {
    if (!open) {
      setNewlyGeneratedSecret(null);
    }
  }, [open]);

  const handleSecretCreated = (secret: string, name: string) => {
    setNewlyGeneratedSecret({ secret, name });
  };

  // Subdomain/slug is the simple identifier users will recognize
  const slug = config?.subdomain ?? '';

  // Optional API URL for self-hosted/local dev
  const apiUrl = process.env.NEXT_PUBLIC_PILLAR_API_URL || 'https://help-api.trypillar.com';
  const isLocalDev = apiUrl.includes('localhost');

  const isInitializing = isLoading;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline">
            <Code2 className="mr-2 h-4 w-4" />
            Configure Sync
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Code2 className="h-5 w-5" />
            Configure Action Sync
          </DialogTitle>
          <DialogDescription>
            Add these environment variables to your CI/CD pipeline to sync actions from your code.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {isInitializing ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : (
            <>
              {/* Product Slug */}
              <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-purple-500" />
                    <code className="font-mono text-sm font-medium">PILLAR_SLUG</code>
                  </div>
                  <CopyButton value={`PILLAR_SLUG=${slug}`} />
                </div>
                <p className="text-xs text-muted-foreground">
                  Your Pillar subdomain
                </p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded bg-background border px-3 py-2 font-mono text-xs">
                    {slug}
                  </div>
                  <CopyButton value={slug} />
                </div>
              </div>

              {/* Newly Generated Secret Warning */}
              {newlyGeneratedSecret && (
                <Alert variant="default" className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/30">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertTitle className="text-amber-800 dark:text-amber-200">
                    Copy Your &quot;{newlyGeneratedSecret.name}&quot; Secret Now!
                  </AlertTitle>
                  <AlertDescription className="text-amber-700 dark:text-amber-300 space-y-2">
                    <p>This secret will only be shown once. Copy it now and store it securely.</p>
                    <div className="flex items-center gap-2 mt-2">
                      <code className="flex-1 rounded bg-background border px-3 py-2 font-mono text-xs break-all">
                        {newlyGeneratedSecret.secret}
                      </code>
                      <CopyButton value={newlyGeneratedSecret.secret} />
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Sync Secrets Table */}
              {config?.id && (
                <SecretsTable productId={config.id} onSecretCreated={handleSecretCreated} />
              )}

              {/* Advanced/Optional Settings */}
              {isLocalDev && (
                <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-full justify-between">
                      <span className="text-sm text-muted-foreground">
                        Advanced: API URL (for local dev)
                      </span>
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
                      />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2">
                    <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Server className="h-4 w-4 text-blue-500" />
                          <code className="font-mono text-sm font-medium">PILLAR_API_URL</code>
                          <span className="text-xs text-muted-foreground">(optional)</span>
                        </div>
                        <CopyButton value={`PILLAR_API_URL=${apiUrl}`} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Only needed for local development. Defaults to https://help-api.trypillar.com
                      </p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 rounded bg-background border px-3 py-2 font-mono text-xs">
                          {apiUrl}
                        </div>
                        <CopyButton value={apiUrl} />
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Usage Examples */}
              <Tabs defaultValue="github" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="github">GitHub Actions</TabsTrigger>
                  <TabsTrigger value="local">Local Development</TabsTrigger>
                </TabsList>
                <TabsContent value="github" className="space-y-3">
                  <div className="relative">
                    <pre className="rounded-lg bg-zinc-950 p-4 text-xs text-zinc-100 overflow-x-auto">
                      <code>{`# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - run: npm ci
      - run: npm run build
      
      # Sync actions to Pillar
      # Use environment-specific secrets: PILLAR_SECRET_PROD, PILLAR_SECRET_STAGING, etc.
      - run: npm run extract-actions && npm run sync-actions
        env:
          PILLAR_SLUG: \${{ secrets.PILLAR_SLUG }}
          PILLAR_SECRET: \${{ secrets.PILLAR_SECRET_PROD }}`}</code>
                    </pre>
                    <CopyButton
                      value={`# Sync actions to Pillar
- run: npm run extract-actions && npm run sync-actions
  env:
    PILLAR_SLUG: \${{ secrets.PILLAR_SLUG }}
    PILLAR_SECRET: \${{ secrets.PILLAR_SECRET_PROD }}`}
                      className="absolute top-2 right-2"
                    />
                  </div>
                </TabsContent>
                <TabsContent value="local" className="space-y-3">
                  <div className="relative">
                    <pre className="rounded-lg bg-zinc-950 p-4 text-xs text-zinc-100 overflow-x-auto">
                      <code>{`# Add to your .env.local file
PILLAR_SLUG=${slug || 'your-slug'}
PILLAR_SECRET=${newlyGeneratedSecret ? newlyGeneratedSecret.secret : '<generate-a-secret-above>'}${isLocalDev ? `\nPILLAR_API_URL=${apiUrl}` : ''}

# Then run:
npm run extract-actions && npm run sync-actions`}</code>
                    </pre>
                    <CopyButton
                      value={
                        newlyGeneratedSecret
                          ? `PILLAR_SLUG=${slug}\nPILLAR_SECRET=${newlyGeneratedSecret.secret}${isLocalDev ? `\nPILLAR_API_URL=${apiUrl}` : ''}`
                          : ''
                      }
                      className="absolute top-2 right-2"
                      disabled={!newlyGeneratedSecret}
                    />
                  </div>
                </TabsContent>
              </Tabs>

              {/* Documentation Link */}
              <div className="flex items-center justify-between rounded-lg bg-muted/50 p-4">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">Need help defining actions?</p>
                  <p className="text-xs text-muted-foreground">
                    Learn how to export actions from your code
                  </p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <a href="/help/features/actions" target="_blank" rel="noopener">
                    <ExternalLink className="mr-2 h-3 w-3" />
                    View Docs
                  </a>
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
