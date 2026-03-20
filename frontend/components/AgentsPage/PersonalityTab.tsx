"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Agent, AgentTone } from "@/types/agent";
import { TONE_LABELS } from "@/types/agent";

const LANGUAGE_OPTIONS = [
  { value: "", label: "Use product default" },
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

interface PersonalityTabProps {
  agent: Agent;
  productGuidance: string;
  onChange: (updates: Partial<Agent>) => void;
}

export function PersonalityTab({
  agent,
  productGuidance,
  onChange,
}: PersonalityTabProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="agent-name">Display Name</Label>
        <Input
          id="agent-name"
          value={agent.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="e.g., Support Bot"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="agent-tone">Tone</Label>
        <Select
          value={agent.tone || "_none"}
          onValueChange={(v) =>
            onChange({ tone: v === "_none" ? "" : (v as AgentTone) })
          }
        >
          <SelectTrigger id="agent-tone">
            <SelectValue placeholder="Use product default" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_none">Use product default</SelectItem>
            {(Object.entries(TONE_LABELS) as [AgentTone, string][]).map(
              ([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Channel-specific Guidance</Label>
        {productGuidance && (
          <div className="rounded-md bg-muted/50 border p-3 text-xs text-muted-foreground">
            <p className="font-medium mb-1">Product guidance (read-only):</p>
            <p className="whitespace-pre-wrap">{productGuidance}</p>
          </div>
        )}
        <Textarea
          value={agent.guidance_override}
          onChange={(e) => onChange({ guidance_override: e.target.value })}
          placeholder="Additional instructions for this channel..."
          className="min-h-[100px]"
        />
        <p className="text-xs text-muted-foreground">
          Appended to product guidance. Use for channel-specific behavior.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="agent-language">Language Override</Label>
        <Select
          value={agent.default_language || ""}
          onValueChange={(v) => onChange({ default_language: v })}
        >
          <SelectTrigger id="agent-language">
            <SelectValue placeholder="Use product default" />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value || "_empty"} value={opt.value || "_empty"}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
