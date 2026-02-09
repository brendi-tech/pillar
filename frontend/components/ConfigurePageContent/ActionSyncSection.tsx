'use client';

import { Code2, Zap } from 'lucide-react';
import Link from 'next/link';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ActionSyncModal } from '@/components/ActionsPageContent';

/**
 * Settings section for code-first action sync.
 *
 * Provides quick access to configure sync and view actions.
 */
export function ActionSyncSection() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Code2 className="h-5 w-5" />
          Code-First Actions
        </CardTitle>
        <CardDescription>
          Define actions in your client code and sync them to Pillar via your CI/CD pipeline.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Export actions from a barrel file and sync them to Pillar using{' '}
          <code className="text-xs bg-muted px-1 py-0.5 rounded">npx pillar-sync</code> in your CI/CD pipeline.
        </p>
        
        <div className="flex flex-col gap-3 sm:flex-row">
          <ActionSyncModal
            trigger={
              <Button variant="default" className="flex-1">
                <Code2 className="mr-2 h-4 w-4" />
                Configure Sync
              </Button>
            }
          />
          <Link href="/actions" className="flex-1">
            <Button variant="outline" className="w-full">
              <Zap className="mr-2 h-4 w-4" />
              View Actions
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
