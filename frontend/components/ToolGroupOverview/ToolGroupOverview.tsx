"use client";

import { DetailHeader, SectionLabel } from "@/components/shared";
import { SyntaxHighlightedPre } from "@/components/mdx/SyntaxHighlightedPre";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FRAMEWORKS,
  INSTALL_COMMANDS,
  TOOL_EXAMPLES,
} from "@/components/InlineOnboardingSteps/InlineOnboardingSteps.constants";
import type { FrameworkId } from "@/components/InlineOnboardingSteps/InlineOnboardingSteps.types";
import { cn } from "@/lib/utils";
import { useProduct } from "@/providers";
import { actionListQuery } from "@/queries/actions.queries";
import type { Action, ToolExecutionType } from "@/types/actions";
import { ACTION_TYPE_LABELS } from "@/types/actions";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Monitor, Server } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

interface ToolGroupOverviewProps {
  type: ToolExecutionType;
}

const GROUP_CONFIG = {
  client_side: {
    title: "Client Tools",
    subtitle: "Tools that run in the user's browser",
    icon: Monitor,
  },
  server_side: {
    title: "Server Tools",
    subtitle: "Tools that run on your backend server",
    icon: Server,
  },
} as const;

const SERVER_TOOL_EXAMPLE = `import { defineTool } from '@pillar-ai/sdk-server';
import { z } from 'zod';

const lookupCustomer = defineTool({
  name: 'lookup_customer',
  description: 'Look up a customer by email address',
  input: z.object({
    email: z.string().email(),
  }),
  execute: async ({ email }, ctx) => {
    const customer = await db.customers.findByEmail(email);
    return { name: customer.name, plan: customer.plan };
  },
});`;

const SERVER_REGISTER_EXAMPLE = `import { Pillar } from '@pillar-ai/sdk-server';
import { lookupCustomer } from './tools';

const pillar = new Pillar({
  secret: process.env.PILLAR_SECRET,
  tools: [lookupCustomer],
  endpointUrl: 'https://your-app.com/api/pillar',
});

// Auto-registers tools on first request, or call manually:
await pillar.register();`;

export function ToolGroupOverview({ type }: ToolGroupOverviewProps) {
  const { currentProduct } = useProduct();
  const config = GROUP_CONFIG[type];
  const Icon = config.icon;

  const [framework, setFramework] = useState<FrameworkId>("react");

  const { data } = useQuery(
    actionListQuery({
      product: currentProduct?.id,
      page_size: 200,
    })
  );

  const tools = useMemo(
    () => (data?.results ?? []).filter((t) => t.tool_type === type),
    [data?.results, type]
  );

  const toolsByType = useMemo(() => {
    const groups: Record<string, Action[]> = {};
    for (const tool of tools) {
      const t = tool.action_type ?? "unknown";
      (groups[t] ??= []).push(tool);
    }
    for (const list of Object.values(groups)) {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }
    return Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
  }, [tools]);

  return (
    <div className="p-6 space-y-8 max-w-3xl">
      <DetailHeader
        title={config.title}
        subtitle={config.subtitle}
        icon={<Icon className="h-5 w-5" />}
        badges={
          <Badge variant="secondary">
            {tools.length} tool{tools.length !== 1 ? "s" : ""} registered
          </Badge>
        }
      />

      {toolsByType.length > 0 && (
        <div>
          <SectionLabel>Registered Tools</SectionLabel>
          <div className="space-y-1">
            {toolsByType.map(([actionType, groupTools]) => (
              <ToolTypeGroup
                key={actionType}
                actionType={actionType}
                tools={groupTools}
              />
            ))}
          </div>
        </div>
      )}

      {type === "client_side" ? (
        <ClientToolInstructions
          framework={framework}
          onFrameworkChange={setFramework}
        />
      ) : (
        <ServerToolInstructions />
      )}
    </div>
  );
}

function ClientToolInstructions({
  framework,
  onFrameworkChange,
}: {
  framework: FrameworkId;
  onFrameworkChange: (f: FrameworkId) => void;
}) {
  return (
    <>
      <div>
        <SectionLabel>Install</SectionLabel>
        <p className="text-sm text-muted-foreground mb-3">
          Add the Pillar SDK for your framework.
        </p>
        <Tabs
          value={framework}
          onValueChange={(v) => onFrameworkChange(v as FrameworkId)}
        >
          <TabsList className="w-full justify-start">
            {FRAMEWORKS.map((f) => (
              <TabsTrigger key={f.id} value={f.id} className="shrink-0">
                {f.name}
              </TabsTrigger>
            ))}
          </TabsList>
          {FRAMEWORKS.map((f) => (
            <TabsContent key={f.id} value={f.id} className="mt-3">
              <SyntaxHighlightedPre
                code={INSTALL_COMMANDS[f.id]}
                language="bash"
              />
            </TabsContent>
          ))}
        </Tabs>
      </div>

      <div>
        <SectionLabel>Define a Tool</SectionLabel>
        <p className="text-sm text-muted-foreground mb-3">
          Tools let the AI assistant perform actions in your app. Define them
          in your client code and they get discovered automatically.
        </p>
        <Tabs
          value={framework}
          onValueChange={(v) => onFrameworkChange(v as FrameworkId)}
        >
          <TabsList className="w-full justify-start">
            {FRAMEWORKS.map((f) => (
              <TabsTrigger key={f.id} value={f.id} className="shrink-0">
                {f.name}
              </TabsTrigger>
            ))}
          </TabsList>
          {FRAMEWORKS.map((f) => {
            const example = TOOL_EXAMPLES[f.id];
            return (
              <TabsContent key={f.id} value={f.id} className="mt-3">
                <SyntaxHighlightedPre
                  code={example.code}
                  language={example.language}
                  filePath={example.filePath}
                  docsUrl="https://trypillar.com/docs/guides/tools"
                />
              </TabsContent>
            );
          })}
        </Tabs>
      </div>

      <div>
        <SectionLabel>Sync</SectionLabel>
        <p className="text-sm text-muted-foreground mb-3">
          The CLI scans your code for tool definitions and syncs them to
          Pillar. Run this in your CI/CD pipeline to keep tools up to date.
        </p>
        <SyntaxHighlightedPre
          code="npx pillar-sync --scan ./src"
          language="bash"
        />
      </div>
    </>
  );
}

function ToolTypeGroup({
  actionType,
  tools,
}: {
  actionType: string;
  tools: Action[];
}) {
  const [open, setOpen] = useState(false);
  const label =
    ACTION_TYPE_LABELS[actionType as keyof typeof ACTION_TYPE_LABELS] ??
    actionType;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm hover:bg-muted transition-colors">
        <ChevronRight
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-90"
          )}
        />
        <span className="font-mono text-xs">{actionType}</span>
        <span className="text-muted-foreground text-xs hidden sm:inline">
          {label}
        </span>
        <Badge variant="secondary" className="ml-auto text-[10px]">
          {tools.length}
        </Badge>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-5 border-l pl-3 py-1 space-y-0.5">
          {tools.map((tool) => (
            <Link
              key={tool.id}
              href={`/tools/${tool.id}`}
              className="grid grid-cols-[minmax(0,1fr)_3fr] items-baseline gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors"
            >
              <span className="font-medium font-mono text-xs break-all">
                {tool.name}
              </span>
              <span className="text-xs text-muted-foreground truncate">
                {tool.description || "\u00A0"}
              </span>
            </Link>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ServerToolInstructions() {
  return (
    <>
      <div>
        <SectionLabel>Install</SectionLabel>
        <p className="text-sm text-muted-foreground mb-3">
          Add the Pillar server SDK to your Node.js backend.
        </p>
        <SyntaxHighlightedPre
          code="npm install @pillar-ai/sdk-server"
          language="bash"
        />
      </div>

      <div>
        <SectionLabel>Define a Tool</SectionLabel>
        <p className="text-sm text-muted-foreground mb-3">
          Server tools run on your backend and can access databases, APIs, and
          other server-side resources. Define them with{" "}
          <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">
            defineTool()
          </code>{" "}
          and a Zod input schema.
        </p>
        <SyntaxHighlightedPre
          code={SERVER_TOOL_EXAMPLE}
          language="typescript"
          filePath="tools/lookup-customer.ts"
          docsUrl="https://trypillar.com/docs/guides/server-tools"
        />
      </div>

      <div>
        <SectionLabel>Register</SectionLabel>
        <p className="text-sm text-muted-foreground mb-3">
          Initialize the Pillar server SDK with your tools. They register
          automatically on first request, or you can call{" "}
          <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">
            register()
          </code>{" "}
          explicitly.
        </p>
        <SyntaxHighlightedPre
          code={SERVER_REGISTER_EXAMPLE}
          language="typescript"
          filePath="api/pillar.ts"
          docsUrl="https://trypillar.com/docs/guides/server-tools"
        />
      </div>
    </>
  );
}
