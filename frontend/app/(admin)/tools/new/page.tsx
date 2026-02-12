'use client';

import { ActionSyncModal } from '@/components/ActionsPageContent';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Code2, ExternalLink, Rocket } from 'lucide-react';
import Link from 'next/link';

/**
 * Create new action page - Now displays code-first workflow info.
 * 
 * Code-First Actions: All actions must be defined in client code
 * and synced via CI/CD. Direct creation through the admin UI is disabled.
 */
export default function CreateActionPage() {
  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-2xl space-y-6 p-6">

        {/* Main Card */}
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 rounded-full bg-primary/10 p-3">
              <Code2 className="h-8 w-8 text-primary" />
            </div>
            <CardTitle>Code-First Actions</CardTitle>
            <CardDescription className="text-base">
              Actions are now defined in your client code and synced via CI/CD
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* How it works */}
            <div className="space-y-4">
              <h3 className="font-medium">How to define actions:</h3>
              <ol className="space-y-3 text-sm text-muted-foreground">
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                    1
                  </span>
                  <span>
                    Export actions from a barrel file (e.g.,{' '}
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                      lib/pillar/actions/index.ts
                    </code>)
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                    2
                  </span>
                  <span>
                    Run{' '}
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                      npx pillar-sync --actions ./lib/pillar/actions/index.ts
                    </code>{' '}
                    in your CI/CD pipeline
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                    3
                  </span>
                  <span>
                    Register handlers at runtime via{' '}
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                      pillar.onTask()
                    </code>
                  </span>
                </li>
              </ol>
            </div>

            {/* Code example */}
            <div className="space-y-2">
              <h3 className="font-medium">Example:</h3>
              <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-xs">
{`// lib/pillar/actions/index.ts
import type { SyncActionDefinitions } from '@pillar-ai/sdk';

export const actions = {
  open_settings: {
    description: 'Opens the settings page',
    type: 'navigate',
    path: '/settings',
    autoRun: true,
  },
  invite_team_member: {
    description: 'Opens team member invitation modal',
    type: 'trigger_tool',
  },
} as const satisfies SyncToolDefinitions;

export default actions;`}
              </pre>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <ActionSyncModal
                trigger={
                  <Button variant="default" className="w-full flex-1">
                    <Code2 className="mr-2 h-4 w-4" />
                    Configure Sync
                  </Button>
                }
              />
              <Link href="/actions/deployments" className="flex-1">
                <Button variant="outline" className="w-full">
                  <Rocket className="mr-2 h-4 w-4" />
                  View Deployments
                </Button>
              </Link>
            </div>

            {/* Documentation link */}
            <div className="border-t pt-4">
              <a
                href="https://docs.pillar.dev/actions/code-first"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
              >
                Read the documentation
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
