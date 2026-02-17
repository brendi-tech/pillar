"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { actionTemplatesQuery } from "@/queries/actions.queries";
import type { ActionTemplate } from "@/types/actions";
import { ACTION_TYPE_ICONS, deriveActionLabel } from "@/types/actions";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowUpCircle,
  Download,
  MessageCircle,
  PlayCircle,
  Plus,
  Settings,
  UserPlus,
  Zap,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

interface ActionTemplateSelectorProps {
  onSelectTemplate: (template: ActionTemplate) => void;
  onStartFromScratch: () => void;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  "user-plus": <UserPlus className="h-5 w-5" />,
  "arrow-up-circle": <ArrowUpCircle className="h-5 w-5" />,
  settings: <Settings className="h-5 w-5" />,
  "message-circle": <MessageCircle className="h-5 w-5" />,
  "play-circle": <PlayCircle className="h-5 w-5" />,
  download: <Download className="h-5 w-5" />,
  "arrow-right": <ArrowRight className="h-5 w-5" />,
};

export function ActionTemplateSelector({
  onSelectTemplate,
  onStartFromScratch,
}: ActionTemplateSelectorProps) {
  const {
    data: templates,
    isLoading,
    error,
  } = useQuery(actionTemplatesQuery());

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Start from scratch */}
      <Card
        className="cursor-pointer border-dashed transition-colors hover:border-primary hover:bg-accent"
        onClick={onStartFromScratch}
      >
        <CardContent className="flex items-center gap-4 p-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
            <Plus className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-medium">Start from scratch</h3>
            <p className="text-sm text-muted-foreground">
              Create a custom action with your own configuration
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Templates */}
      {templates && templates.length > 0 && (
        <>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or choose a template
              </span>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((template) => {
              // Derive icon from action type
              const iconName = ACTION_TYPE_ICONS[template.action_type];
              const iconElement = iconName && ICON_MAP[iconName];

              return (
                <Card
                  key={template.id}
                  className="cursor-pointer transition-colors hover:border-primary hover:bg-accent"
                  onClick={() => onSelectTemplate(template)}
                >
                  <CardHeader className="">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        {iconElement || <Zap className="h-5 w-5" />}
                      </div>
                      <CardTitle>
                        {deriveActionLabel(template.name)}
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="line-clamp-3">
                      {template.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {error && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-700 dark:border-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400">
          Couldn&apos;t load templates. You can still start from scratch.
        </div>
      )}
    </div>
  );
}
