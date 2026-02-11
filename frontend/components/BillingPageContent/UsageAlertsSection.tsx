"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronDown,
  ChevronUp,
  Check,
  Mail,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { UsageAlert } from "./BillingPageContent";

interface UsageAlertsSectionProps {
  alerts: UsageAlert;
  onUpdate: (alerts: Partial<UsageAlert>) => void;
  defaultExpanded?: boolean;
  highlight?: boolean;
}

export function UsageAlertsSection({
  alerts,
  onUpdate,
  defaultExpanded = false,
  highlight = false,
}: UsageAlertsSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultExpanded);
  const [localThreshold, setLocalThreshold] = useState(
    alerts.threshold.toString()
  );
  const [hasChanges, setHasChanges] = useState(false);

  // Sync local state when alerts prop changes (e.g., from Pillar card)
  useEffect(() => {
    setLocalThreshold(alerts.threshold.toString());
    setHasChanges(false);
  }, [alerts.threshold]);

  // Auto-expand when defaultExpanded changes
  useEffect(() => {
    if (defaultExpanded) {
      setIsOpen(true);
    }
  }, [defaultExpanded]);

  const handleThresholdChange = (value: string) => {
    setLocalThreshold(value);
    setHasChanges(true);
  };

  const handleChannelChange = (channel: "email" | "slack") => {
    onUpdate({ channel });
    toast.success(`Notification channel updated to ${channel}`);
  };

  const handleEnabledChange = (enabled: boolean) => {
    onUpdate({ enabled });
    toast.success(enabled ? "Usage alerts enabled" : "Usage alerts disabled");
  };

  const handleSaveThreshold = () => {
    const value = parseInt(localThreshold, 10);
    if (isNaN(value) || value <= 0) {
      toast.error("Please enter a valid threshold amount");
      return;
    }
    onUpdate({ threshold: value });
    setHasChanges(false);
    toast.success(`Alert threshold set to $${value}`);
  };

  return (
    <Card
      className={cn(
        "transition-all duration-500",
        highlight && "ring-2 ring-primary ring-offset-2 ring-offset-background"
      )}
    >
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer rounded-t-lg transition-colors hover:bg-muted/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle>Usage Alerts</CardTitle>
                {alerts.enabled && (
                  <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                    <Check className="h-3 w-3" />
                    Active
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {alerts.enabled && !isOpen && (
                  <span className="text-xs text-muted-foreground">
                    Alert at ${alerts.threshold} via {alerts.channel}
                  </span>
                )}
                {isOpen ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-6 pt-0">
            <p className="text-sm text-muted-foreground">
              Get notified when your monthly spending reaches a certain
              threshold. This helps prevent unexpected charges.
            </p>

            {/* Enable/Disable Toggle */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="alerts-enabled" className="text-base">
                  Enable Usage Alerts
                </Label>
                <p className="text-sm text-muted-foreground">
                  Receive notifications when spending exceeds your threshold
                </p>
              </div>
              <Switch
                id="alerts-enabled"
                checked={alerts.enabled}
                onCheckedChange={handleEnabledChange}
              />
            </div>

            {/* Alert Configuration */}
            <div
              className={cn(
                "space-y-4 transition-opacity",
                !alerts.enabled && "pointer-events-none opacity-50"
              )}
            >
              {/* Threshold Amount */}
              <div className="space-y-2">
                <Label htmlFor="threshold">Alert Threshold</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      $
                    </span>
                    <Input
                      id="threshold"
                      type="number"
                      value={localThreshold}
                      onChange={(e) => handleThresholdChange(e.target.value)}
                      className="pl-7"
                      placeholder="500"
                      min={1}
                    />
                  </div>
                  {hasChanges && (
                    <Button onClick={handleSaveThreshold}>Save</Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  You&apos;ll be notified when your monthly spending reaches
                  this amount
                </p>
              </div>

              {/* Notification Channel */}
              <div className="space-y-2">
                <Label htmlFor="channel">Notification Channel</Label>
                <Select
                  value={alerts.channel}
                  onValueChange={(value) =>
                    handleChannelChange(value as "email" | "slack")
                  }
                >
                  <SelectTrigger id="channel" className="w-full">
                    <SelectValue placeholder="Select channel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        Email
                      </div>
                    </SelectItem>
                    <SelectItem value="slack">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        Slack
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Where you&apos;ll receive spending alert notifications
                </p>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
