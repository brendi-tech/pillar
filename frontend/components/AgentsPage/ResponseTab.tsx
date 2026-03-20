"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Agent } from "@/types/agent";

const MODEL_OPTIONS = [
  { value: "", label: "Use product default" },
  { value: "anthropic/flagship", label: "Anthropic Flagship" },
  { value: "anthropic/standard", label: "Anthropic Standard" },
  { value: "openai/flagship", label: "OpenAI Flagship" },
  { value: "openai/standard", label: "OpenAI Standard" },
  { value: "google/flagship", label: "Google Flagship" },
  { value: "google/standard", label: "Google Standard" },
];

interface ResponseTabProps {
  agent: Agent;
  onChange: (updates: Partial<Agent>) => void;
}

export function ResponseTab({ agent, onChange }: ResponseTabProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label>Include Sources</Label>
          <p className="text-xs text-muted-foreground">
            Show source citations in responses
          </p>
        </div>
        <Switch
          checked={agent.include_sources}
          onCheckedChange={(checked) => onChange({ include_sources: checked })}
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label>Suggested Follow-ups</Label>
          <p className="text-xs text-muted-foreground">
            Suggest follow-up questions after responses
          </p>
        </div>
        <Switch
          checked={agent.include_suggested_followups}
          onCheckedChange={(checked) =>
            onChange({ include_suggested_followups: checked })
          }
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="max-tokens">Max Response Tokens</Label>
        <Input
          id="max-tokens"
          type="number"
          value={agent.max_response_tokens ?? ""}
          onChange={(e) =>
            onChange({
              max_response_tokens: e.target.value
                ? parseInt(e.target.value, 10)
                : null,
            })
          }
          placeholder="Model default"
          min={100}
          max={16000}
        />
        <p className="text-xs text-muted-foreground">
          Leave empty to use the model&apos;s default limit.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="llm-model">LLM Model</Label>
        <Select
          value={agent.llm_model || ""}
          onValueChange={(v) => onChange({ llm_model: v })}
        >
          <SelectTrigger id="llm-model">
            <SelectValue placeholder="Use product default" />
          </SelectTrigger>
          <SelectContent>
            {MODEL_OPTIONS.map((opt) => (
              <SelectItem key={opt.value || "_default"} value={opt.value || "_default"}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Temperature</Label>
          <span className="text-sm text-muted-foreground tabular-nums">
            {agent.temperature != null ? agent.temperature.toFixed(2) : "Default"}
          </span>
        </div>
        <Slider
          value={[agent.temperature ?? 0.3]}
          onValueChange={([v]) => onChange({ temperature: v })}
          min={0}
          max={2}
          step={0.05}
          className="w-full"
        />
        <p className="text-xs text-muted-foreground">
          Lower = more focused, higher = more creative.
        </p>
      </div>
    </div>
  );
}
