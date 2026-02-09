"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type {
  AgentType,
  DrafterConfig,
  GardenerConfig,
  LibrarianConfig,
} from "@/types/admin";
import { Settings } from "lucide-react";

interface AgentConfigPanelProps {
  agentType: AgentType;
  config: LibrarianConfig | DrafterConfig | GardenerConfig;
  onChange?: (config: LibrarianConfig | DrafterConfig | GardenerConfig) => void;
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <div className="relative mt-0.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <div
          className={cn(
            "h-5 w-9 rounded-full transition-colors",
            "bg-muted peer-checked:bg-emerald-500",
            "peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2"
          )}
        />
        <div
          className={cn(
            "absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
            "peer-checked:translate-x-4"
          )}
        />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground group-hover:text-foreground/80 transition-colors">
          {label}
        </p>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
    </label>
  );
}

function NumberInput({
  label,
  value,
  onChange,
  min,
  max,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  suffix?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <label className="text-sm font-medium text-foreground">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value) || 0)}
          min={min}
          max={max}
          className={cn(
            "w-20 rounded-md border border-input bg-background px-3 py-1.5 text-sm",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            "tabular-nums text-right"
          )}
        />
        {suffix && (
          <span className="text-sm text-muted-foreground">{suffix}</span>
        )}
      </div>
    </div>
  );
}

function LibrarianConfigPanel({
  config,
  onChange,
}: {
  config: LibrarianConfig;
  onChange?: (config: LibrarianConfig) => void;
}) {
  const handleChange = (
    key: keyof LibrarianConfig,
    value: boolean | number
  ) => {
    onChange?.({ ...config, [key]: value });
  };

  return (
    <div className="space-y-4">
      <Toggle
        label="Auto-categorize"
        description="Automatically assign categories to new articles"
        checked={config.autoCategorize}
        onChange={(v) => handleChange("autoCategorize", v)}
      />
      <Toggle
        label="Detect duplicates"
        description="Flag articles with similar content"
        checked={config.detectDuplicates}
        onChange={(v) => handleChange("detectDuplicates", v)}
      />
      <Toggle
        label="Find related articles"
        description="Suggest related content links"
        checked={config.findRelatedArticles}
        onChange={(v) => handleChange("findRelatedArticles", v)}
      />
      <Toggle
        label="Suggest tags"
        description="Recommend tags based on content analysis"
        checked={config.suggestTags}
        onChange={(v) => handleChange("suggestTags", v)}
      />
      <div className="pt-4 border-t border-border/50">
        <NumberInput
          label="Similarity threshold"
          value={config.minSimilarityThreshold}
          onChange={(v) => handleChange("minSimilarityThreshold", v)}
          min={50}
          max={100}
          suffix="%"
        />
      </div>
    </div>
  );
}

function DrafterConfigPanel({
  config,
  onChange,
}: {
  config: DrafterConfig;
  onChange?: (config: DrafterConfig) => void;
}) {
  const handleChange = (key: keyof DrafterConfig, value: number | object) => {
    onChange?.({ ...config, [key]: value });
  };

  const handleSourceChange = (
    source: keyof DrafterConfig["sources"],
    value: boolean
  ) => {
    onChange?.({
      ...config,
      sources: { ...config.sources, [source]: value },
    });
  };

  return (
    <div className="space-y-4">
      <NumberInput
        label="Trigger threshold"
        value={config.triggerThreshold}
        onChange={(v) => handleChange("triggerThreshold", v)}
        min={2}
        max={20}
        suffix="similar questions"
      />
      <NumberInput
        label="Min confidence"
        value={config.minConfidence}
        onChange={(v) => handleChange("minConfidence", v)}
        min={50}
        max={100}
        suffix="%"
      />
      <div className="pt-4 border-t border-border/50">
        <p className="text-sm font-medium text-foreground mb-3">Sources</p>
        <div className="space-y-3">
          <Toggle
            label="Support tickets"
            checked={config.sources.tickets}
            onChange={(v) => handleSourceChange("tickets", v)}
          />
          <Toggle
            label="Slack questions"
            checked={config.sources.slack}
            onChange={(v) => handleSourceChange("slack", v)}
          />
          <Toggle
            label="Email inquiries"
            checked={config.sources.email}
            onChange={(v) => handleSourceChange("email", v)}
          />
          <Toggle
            label="Community forum"
            checked={config.sources.forum}
            onChange={(v) => handleSourceChange("forum", v)}
          />
        </div>
      </div>
    </div>
  );
}

function GardenerConfigPanel({
  config,
  onChange,
}: {
  config: GardenerConfig;
  onChange?: (config: GardenerConfig) => void;
}) {
  const handleChange = (
    key: keyof GardenerConfig,
    value: number | boolean | object
  ) => {
    onChange?.({ ...config, [key]: value });
  };

  return (
    <div className="space-y-4">
      <NumberInput
        label="Check frequency"
        value={config.checkFrequencyHours}
        onChange={(v) => handleChange("checkFrequencyHours", v)}
        min={1}
        max={168}
        suffix="hours"
      />
      <NumberInput
        label="Stale threshold"
        value={config.staleThresholdDays}
        onChange={(v) => handleChange("staleThresholdDays", v)}
        min={7}
        max={365}
        suffix="days"
      />
      <div className="pt-4 border-t border-border/50">
        <Toggle
          label="Auto-refresh screenshots"
          description="Automatically update screenshots when UI changes are detected"
          checked={config.autoRefreshScreenshots}
          onChange={(v) => handleChange("autoRefreshScreenshots", v)}
        />
      </div>
      <div className="pt-4 border-t border-border/50">
        <p className="text-sm font-medium text-foreground mb-3">
          Monitored Sources
        </p>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">
              Product Changelog
            </label>
            <input
              type="text"
              value={config.monitoredSources.productChangelog || ""}
              onChange={(e) =>
                handleChange("monitoredSources", {
                  ...config.monitoredSources,
                  productChangelog: e.target.value || undefined,
                })
              }
              placeholder="https://yourapp.com/changelog"
              className={cn(
                "w-full mt-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm",
                "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                "placeholder:text-muted-foreground/50"
              )}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">
              API Changelog
            </label>
            <input
              type="text"
              value={config.monitoredSources.apiChangelog || ""}
              onChange={(e) =>
                handleChange("monitoredSources", {
                  ...config.monitoredSources,
                  apiChangelog: e.target.value || undefined,
                })
              }
              placeholder="https://api.yourapp.com/changelog"
              className={cn(
                "w-full mt-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm",
                "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                "placeholder:text-muted-foreground/50"
              )}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">
              GitHub Releases
            </label>
            <input
              type="text"
              value={config.monitoredSources.githubReleases || ""}
              onChange={(e) =>
                handleChange("monitoredSources", {
                  ...config.monitoredSources,
                  githubReleases: e.target.value || undefined,
                })
              }
              placeholder="https://github.com/org/repo"
              className={cn(
                "w-full mt-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm",
                "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                "placeholder:text-muted-foreground/50"
              )}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export function AgentConfigPanel({
  agentType,
  config,
  onChange,
}: AgentConfigPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Configuration
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {agentType === "librarian" && (
          <LibrarianConfigPanel
            config={config as LibrarianConfig}
            onChange={
              onChange as ((config: LibrarianConfig) => void) | undefined
            }
          />
        )}
        {agentType === "drafter" && (
          <DrafterConfigPanel
            config={config as DrafterConfig}
            onChange={onChange as ((config: DrafterConfig) => void) | undefined}
          />
        )}
        {agentType === "gardener" && (
          <GardenerConfigPanel
            config={config as GardenerConfig}
            onChange={
              onChange as ((config: GardenerConfig) => void) | undefined
            }
          />
        )}
      </CardContent>
    </Card>
  );
}
