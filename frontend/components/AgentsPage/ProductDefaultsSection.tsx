"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { adminPatch } from "@/lib/admin/api-client";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const LANGUAGE_OPTIONS = [
  { value: "auto", label: "Auto-detect" },
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "pt", label: "Portuguese" },
  { value: "it", label: "Italian" },
  { value: "zh", label: "Chinese" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
  { value: "ar", label: "Arabic" },
];

interface ProductDefaultsSectionProps {
  productId: string;
  agentGuidance: string;
  defaultLanguage: string;
  onSaved: () => void;
}

export function ProductDefaultsSection({
  productId,
  agentGuidance,
  defaultLanguage,
  onSaved,
}: ProductDefaultsSectionProps) {
  const [guidance, setGuidance] = useState(agentGuidance);
  const [language, setLanguage] = useState(defaultLanguage || "auto");
  const [saving, setSaving] = useState(false);

  const hasChanges =
    guidance !== agentGuidance || language !== (defaultLanguage || "auto");

  const handleSave = async () => {
    setSaving(true);
    try {
      await adminPatch(`/configs/${productId}/`, {
        agent_guidance: guidance,
        default_language: language,
      });
      toast.success("Product defaults saved");
      onSaved();
    } catch {
      toast.error("Failed to save product defaults");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 rounded-lg border border-dashed p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Product Defaults</h3>
          <p className="text-xs text-muted-foreground">
            These settings apply to all agents unless overridden.
          </p>
        </div>
        {hasChanges && (
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Save Defaults
          </Button>
        )}
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="agent-guidance" className="text-xs">
            Agent Guidance
          </Label>
          <Textarea
            id="agent-guidance"
            value={guidance}
            onChange={(e) => setGuidance(e.target.value)}
            placeholder="Instructions for the AI agent across all channels..."
            className="min-h-[80px] text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="default-language" className="text-xs">
            Default Language
          </Label>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger id="default-language" className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
