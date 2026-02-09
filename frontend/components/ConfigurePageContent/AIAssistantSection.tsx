'use client';

import { useConfigure } from './ConfigureContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, X, Sparkles, Globe } from 'lucide-react';
import { LANGUAGE_OPTIONS, type LanguageCode } from '@/types/v2/products';

export function AIAssistantSection() {
  const { aiConfig, updateAIConfig, defaultLanguage, updateDefaultLanguage, agentGuidance, updateAgentGuidance } = useConfigure();

  const handleToggle = (key: 'enabled' | 'openOnLoad') => {
    updateAIConfig({ [key]: !aiConfig[key] });
  };

  const handleChange = (
    key: 'assistantName' | 'welcomeMessage' | 'inputPlaceholder' | 'fallbackMessage',
    value: string
  ) => {
    updateAIConfig({ [key]: value });
  };

  const handleAddQuestion = () => {
    updateAIConfig({
      suggestedQuestions: [...aiConfig.suggestedQuestions, ''],
    });
  };

  const handleUpdateQuestion = (index: number, value: string) => {
    const newQuestions = [...aiConfig.suggestedQuestions];
    newQuestions[index] = value;
    updateAIConfig({ suggestedQuestions: newQuestions });
  };

  const handleRemoveQuestion = (index: number) => {
    updateAIConfig({
      suggestedQuestions: aiConfig.suggestedQuestions.filter((_, i) => i !== index),
    });
  };

  return (
    <Card id="ai">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              AI Assistant
            </CardTitle>
            <CardDescription>
              Configure the AI chat assistant behavior
            </CardDescription>
          </div>
          <Switch
            checked={aiConfig.enabled}
            onCheckedChange={() => handleToggle('enabled')}
          />
        </div>
      </CardHeader>

      {aiConfig.enabled && (
        <CardContent className="space-y-6">
          {/* Assistant Name */}
          <div className="space-y-2">
            <Label htmlFor="ai-name">Display Name</Label>
            <Input
              id="ai-name"
              value={aiConfig.assistantName}
              onChange={(e) => handleChange('assistantName', e.target.value)}
              placeholder="AI Assistant"
            />
            <p className="text-xs text-muted-foreground">
              Name shown in the chat interface
            </p>
          </div>

          {/* Welcome Message */}
          <div className="space-y-2">
            <Label htmlFor="ai-welcome">Welcome Message</Label>
            <Textarea
              id="ai-welcome"
              value={aiConfig.welcomeMessage}
              onChange={(e) => handleChange('welcomeMessage', e.target.value)}
              placeholder="Hi! I'm here to help you find answers. Ask me anything!"
              rows={3}
            />
          </div>

          {/* Input Placeholder */}
          <div className="space-y-2">
            <Label htmlFor="ai-placeholder">Input Placeholder</Label>
            <Input
              id="ai-placeholder"
              value={aiConfig.inputPlaceholder}
              onChange={(e) => handleChange('inputPlaceholder', e.target.value)}
              placeholder="Type your question..."
            />
          </div>

          <Separator />

          {/* Suggested Questions */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>Suggested Questions</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Shown when the assistant panel opens
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={handleAddQuestion}>
                <Plus className="h-4 w-4" />
                Add Question
              </Button>
            </div>

            {aiConfig.suggestedQuestions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No suggested questions added.</p>
            ) : (
              <div className="space-y-2">
                {aiConfig.suggestedQuestions.map((question, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground w-6 shrink-0">
                      {index + 1}.
                    </span>
                    <Input
                      value={question}
                      onChange={(e) => handleUpdateQuestion(index, e.target.value)}
                      placeholder="Enter a suggested question..."
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveQuestion(index)}
                      className="text-destructive hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Behavior */}
          <div className="space-y-3">
            <Label>Behavior</Label>
            
            {/* Default AI Language */}
            <div className="space-y-2">
              <Label htmlFor="ai-language" className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                Default AI Language
              </Label>
              <Select
                value={defaultLanguage}
                onValueChange={(value) => updateDefaultLanguage(value as LanguageCode)}
              >
                <SelectTrigger id="ai-language" className="w-full">
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Language the AI will use to respond. &quot;Auto-detect&quot; uses the user&apos;s browser language.
              </p>
            </div>
            
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={aiConfig.openOnLoad}
                onChange={() => handleToggle('openOnLoad')}
                className="rounded border-border"
              />
              <span className="text-sm">Open assistant by default on page load</span>
            </label>

            <div className="space-y-2">
              <Label htmlFor="ai-fallback">Fallback Message</Label>
              <Textarea
                id="ai-fallback"
                value={aiConfig.fallbackMessage}
                onChange={(e) => handleChange('fallbackMessage', e.target.value)}
                placeholder="I couldn't find an answer. Would you like to contact support?"
                rows={2}
              />
              <p className="text-xs text-muted-foreground">
                Shown when the AI can&apos;t find an answer
              </p>
            </div>
          </div>

          <Separator />

          {/* Agent Guidance */}
          <div className="space-y-3">
            <Label>Agent Guidance</Label>
            <Textarea
              id="agent-guidance"
              value={agentGuidance}
              onChange={(e) => updateAgentGuidance(e.target.value)}
              placeholder="Enter custom instructions for the AI agent...

Example:
- Prefer API actions (like create_chart) over navigation actions (like navigate_to_chart_builder)
- Always fetch dataset schema before creating charts
- When creating dashboards, include at least 3 charts"
              rows={6}
            />
            <p className="text-xs text-muted-foreground">
              Custom instructions injected into the agent&apos;s prompt. Use this for product-specific tips like &quot;prefer API actions over navigation&quot; or &quot;always verify dataset schema before creating charts.&quot;
            </p>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
