'use client';

import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import {
  Rocket,
  GitCommit,
  Package,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

import { useProduct } from '@/providers/ProductProvider';
import { adminFetch } from '@/lib/admin/api-client';
import type {
  ActionDeployment,
  ActionDeploymentListResponse,
  DeploymentPlatform,
} from '@/types/actions';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const PLATFORM_LABELS: Record<DeploymentPlatform, string> = {
  web: 'Web',
  ios: 'iOS',
  android: 'Android',
  desktop: 'Desktop',
};

const PLATFORM_COLORS: Record<DeploymentPlatform, string> = {
  web: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  ios: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  android: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  desktop: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
};

/**
 * Deployments page - shows all action deployments for a help center.
 * Displays platform, version, action count, and deployment metadata.
 */
export default function DeploymentsPage() {
  const { currentProduct: config } = useProduct();
  const searchParams = useSearchParams();
  const platformFilter = searchParams.get('platform');

  const { data: deploymentsData, isLoading } = useQuery({
    queryKey: ['action-deployments', config?.id, platformFilter],
    queryFn: async () => {
      if (!config?.id) return null;
      const params: Record<string, string> = {};
      if (platformFilter) {
        params.platform = platformFilter;
      }
      return adminFetch<ActionDeploymentListResponse>(`/configs/${config.id}/deployments/`, { params });
    },
    enabled: !!config?.id,
  });

  const deployments = deploymentsData?.results || [];

  return (
    <div className="h-full overflow-auto">
      <div className="space-y-6 p-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Deployments</h1>
          <p className="text-muted-foreground">
            View action deployments synced from code
          </p>
        </div>

      {/* Platform Filter */}
      <div className="flex gap-2">
        <Link href="/actions/deployments">
          <Badge
            variant={!platformFilter ? 'default' : 'outline'}
            className="cursor-pointer"
          >
            All
          </Badge>
        </Link>
        {(['web', 'ios', 'android', 'desktop'] as DeploymentPlatform[]).map(
          (platform) => (
            <Link
              key={platform}
              href={`/actions/deployments?platform=${platform}`}
            >
              <Badge
                variant={platformFilter === platform ? 'default' : 'outline'}
                className="cursor-pointer"
              >
                {PLATFORM_LABELS[platform]}
              </Badge>
            </Link>
          )
        )}
      </div>

      {/* Deployments Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5" />
            Code Deployments
          </CardTitle>
          <CardDescription>
            Action definitions synced from your client-side code via CI/CD
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading deployments...
            </div>
          ) : deployments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">No deployments yet</p>
              <p className="text-sm mt-1">
                Deployments appear when you sync actions from code via CI/CD
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Platform</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Actions</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Git SHA</TableHead>
                  <TableHead>Deployed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deployments.map((deployment: ActionDeployment) => (
                  <TableRow key={deployment.id}>
                    <TableCell>
                      <Badge
                        className={PLATFORM_COLORS[deployment.platform as DeploymentPlatform]}
                        variant="secondary"
                      >
                        {PLATFORM_LABELS[deployment.platform as DeploymentPlatform]}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {deployment.version}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{deployment.action_count}</span>
                      <span className="text-muted-foreground"> actions</span>
                    </TableCell>
                    <TableCell>
                      {deployment.is_active ? (
                        <Badge variant="default" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1">
                          <XCircle className="h-3 w-3" />
                          Inactive
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {deployment.git_sha ? (
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded flex items-center gap-1 w-fit">
                          <GitCommit className="h-3 w-3" />
                          {deployment.git_sha.slice(0, 7)}
                        </code>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(deployment.deployed_at), {
                        addSuffix: true,
                      })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
