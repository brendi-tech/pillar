"use client";

/**
 * SetUsageAlertCard
 *
 * Custom confirmation card for configuring usage alerts via the AI assistant.
 * Renders inline in the chat when the AI suggests setting up spending alerts.
 *
 * Receives data from the AI with threshold and channel, allows the user to
 * modify values, then updates global billing state on confirmation.
 */

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Check, Loader2, X, Bell, Mail, MessageSquare } from "lucide-react";
import { useState, useCallback } from "react";
import { getGlobalUpdateAlerts } from "@/components/BillingPageContent";

// Card component props for custom action cards
interface CardComponentProps<T = Record<string, unknown>> {
  data: T;
  onConfirm: (modifiedData?: Record<string, unknown>) => void;
  onCancel: () => void;
}

interface SetUsageAlertData {
  threshold: number;
  channel: "email" | "slack";
  card_type: string;
}

type CardState = "idle" | "loading" | "success" | "error";

export function SetUsageAlertCard({
  data,
  onConfirm,
  onCancel,
}: CardComponentProps<SetUsageAlertData>) {
  // Local state for editing
  const [threshold, setThreshold] = useState<string>(
    (data.threshold || 500).toString()
  );
  const [channel, setChannel] = useState<"email" | "slack">(
    data.channel || "email"
  );
  const [cardState, setCardState] = useState<CardState>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");

  const handleConfirm = useCallback(() => {
    const thresholdValue = parseInt(threshold, 10);

    // Validate threshold
    if (isNaN(thresholdValue) || thresholdValue <= 0) {
      setErrorMessage("Please enter a valid threshold amount");
      setCardState("error");
      return;
    }

    setCardState("loading");
    setErrorMessage("");

    // Get the global update function and update state
    const updateFn = getGlobalUpdateAlerts();
    if (updateFn) {
      updateFn({
        enabled: true,
        threshold: thresholdValue,
        channel,
      });
    }

    setCardState("success");
    toast.success("Usage alert configured!", {
      description: `You'll be notified via ${channel} when spending reaches $${thresholdValue}`,
    });

    // Delay onConfirm to ensure React renders success state first
    setTimeout(() => {
      onConfirm({ threshold: thresholdValue, channel });
    }, 100);
  }, [threshold, channel, onConfirm]);

  // Success state
  if (cardState === "success") {
    return (
      <div className="mt-3 w-full rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950/30">
        <div className="flex items-center justify-center gap-2 text-green-700 dark:text-green-400">
          <Check className="h-5 w-5" />
          <span className="font-medium">
            Alert set for ${threshold} via {channel}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 w-full rounded-lg border bg-muted/30 p-4">
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <Bell className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Configure Usage Alert</span>
      </div>

      {/* Threshold Input */}
      <div className="mb-4">
        <Label className="mb-2 block text-xs text-muted-foreground">
          Alert Threshold
        </Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            $
          </span>
          <Input
            type="number"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            className="pl-7"
            placeholder="500"
            min={1}
            disabled={cardState === "loading"}
          />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          You&apos;ll be notified when monthly spending reaches this amount
        </p>
      </div>

      {/* Channel Selector */}
      <div className="mb-4">
        <Label className="mb-2 block text-xs text-muted-foreground">
          Notification Channel
        </Label>
        <Select
          value={channel}
          onValueChange={(value) => setChannel(value as "email" | "slack")}
          disabled={cardState === "loading"}
        >
          <SelectTrigger className="w-full">
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
      </div>

      {/* Error message */}
      {cardState === "error" && errorMessage && (
        <div className="mb-4 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          {errorMessage}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={cardState === "loading"}
        >
          <X className="mr-1 h-3.5 w-3.5" />
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleConfirm}
          disabled={cardState === "loading" || !threshold}
        >
          {cardState === "loading" ? (
            <>
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              Setting up...
            </>
          ) : (
            <>
              <Check className="mr-1 h-3.5 w-3.5" />
              Set Alert
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
