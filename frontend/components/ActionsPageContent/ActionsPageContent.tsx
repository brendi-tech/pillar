'use client';

import { EmptyState } from '@/components/shared';
import { PageHeader } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { actionListQuery } from '@/queries/actions.queries';
import { useProduct } from '@/providers';
import type { Action, ActionStatus } from '@/types/actions';
import { ACTION_STATUS_LABELS } from '@/types/actions';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Code2, RefreshCw, Rocket, Search, Zap } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { ActionCard } from './ActionCard';
import { ActionSyncModal } from './ActionSyncModal';

/**
 * Actions Page Content - Read-Only Viewer
 * 
 * Code-First Actions: All actions are defined in client code and synced via CI/CD.
 * This page displays synced actions but does not allow creating/editing/deleting.
 */
export function ActionsPageContent() {
  const { currentProduct } = useProduct();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ActionStatus | 'all'>('all');

  const { data, isLoading, error, refetch } = useQuery(
    actionListQuery({
      product: currentProduct?.id,
      search: search || undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
    })
  );

  const actions = data?.results ?? [];

  if (isLoading) {
    return (
      <div className="space-y-6 p-page">
        <div className="flex items-center justify-between">
          <div className="h-8 w-32 animate-pulse rounded bg-muted" />
          <div className="h-10 w-24 animate-pulse rounded bg-muted" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-page py-12">
        <div className="rounded-full bg-red-100 p-3 dark:bg-red-900/30">
          <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
        </div>
        <h3 className="mt-4 text-lg font-medium">Failed to load actions</h3>
        <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
        <Button onClick={() => refetch()} variant="outline" className="mt-4">
          <RefreshCw className="mr-2 h-4 w-4" />
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-page">
      <PageHeader
        title="Actions"
        description="View actions synced from your client code"
        actions={
          <div className="flex gap-2">
            <ActionSyncModal
              trigger={
                <Button variant="outline">
                  <Code2 className="mr-2 h-4 w-4" />
                  Configure Sync
                </Button>
              }
            />
            <Link href="/actions/deployments">
              <Button variant="outline">
                <Rocket className="mr-2 h-4 w-4" />
                Deployments
              </Button>
            </Link>
          </div>
        }
      />

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search actions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ActionStatus | 'all')}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.entries(ACTION_STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Actions Grid or Empty State */}
      {actions.length === 0 ? (
        <EmptyState
          icon={Zap}
          title="No actions synced"
          description="Actions are defined in your client code and synced via CI/CD. Configure action sync to get started."
          action={
            <div className="flex flex-col gap-3 sm:flex-row">
              <ActionSyncModal
                trigger={
                  <Button variant="outline">
                    <Code2 className="mr-2 h-4 w-4" />
                    Configure Sync
                  </Button>
                }
              />
              <Link href="/actions/deployments">
                <Button variant="outline">
                  <Rocket className="mr-2 h-4 w-4" />
                  View Deployments
                </Button>
              </Link>
            </div>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {actions.map((action: Action) => (
            <ActionCard key={action.id} action={action} />
          ))}
        </div>
      )}
    </div>
  );
}
