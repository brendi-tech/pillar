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
import { Plus, X, Sparkles, Globe, FolderOpen, Pencil, Check } from 'lucide-react';
import { LANGUAGE_OPTIONS, type LanguageCode } from '@/types/v2/products';
import type { SuggestedQuestionConfig } from '@/types/config';
import { useState, useMemo } from 'react';

interface QuestionGroup {
  pathPattern: string | undefined;
  questions: { question: SuggestedQuestionConfig; originalIndex: number }[];
}

export function AIAssistantSection() {
  const { aiConfig, updateAIConfig, defaultLanguage, updateDefaultLanguage, agentGuidance, updateAgentGuidance } = useConfigure();
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [editingPathValue, setEditingPathValue] = useState('');
  const [newPathInput, setNewPathInput] = useState('');
  const [showNewPathInput, setShowNewPathInput] = useState(false);

  const handleToggle = (key: 'enabled' | 'openOnLoad') => {
    updateAIConfig({ [key]: !aiConfig[key] });
  };

  const handleChange = (
    key: 'assistantName' | 'welcomeMessage' | 'inputPlaceholder',
    value: string
  ) => {
    updateAIConfig({ [key]: value });
  };

  // Group questions by pathPattern
  const questionGroups = useMemo((): QuestionGroup[] => {
    const groups = new Map<string, QuestionGroup>();
    
    aiConfig.suggestedQuestions.forEach((q, index) => {
      const pathPattern = typeof q === 'string' ? undefined : q.pathPattern;
      const key = pathPattern || '__all__';
      
      if (!groups.has(key)) {
        groups.set(key, { pathPattern, questions: [] });
      }
      groups.get(key)!.questions.push({ question: typeof q === 'string' ? { text: q } : q, originalIndex: index });
    });

    // Sort: "All pages" first, then alphabetically by path
    const sorted = Array.from(groups.values()).sort((a, b) => {
      if (!a.pathPattern) return -1;
      if (!b.pathPattern) return 1;
      return a.pathPattern.localeCompare(b.pathPattern);
    });

    return sorted;
  }, [aiConfig.suggestedQuestions]);

  const handleAddQuestionToGroup = (pathPattern: string | undefined) => {
    updateAIConfig({
      suggestedQuestions: [...aiConfig.suggestedQuestions, { text: '', pathPattern }],
    });
  };

  const handleAddNewPathGroup = () => {
    if (!newPathInput.trim()) return;
    updateAIConfig({
      suggestedQuestions: [...aiConfig.suggestedQuestions, { text: '', pathPattern: newPathInput.trim() }],
    });
    setNewPathInput('');
    setShowNewPathInput(false);
  };

  const handleUpdateQuestionText = (index: number, text: string) => {
    const newQuestions = [...aiConfig.suggestedQuestions];
    const existing = newQuestions[index];
    newQuestions[index] = { ...(typeof existing === 'string' ? { text: existing } : existing), text };
    updateAIConfig({ suggestedQuestions: newQuestions });
  };

  const handleRemoveQuestion = (index: number) => {
    updateAIConfig({
      suggestedQuestions: aiConfig.suggestedQuestions.filter((_, i) => i !== index),
    });
  };

  const handleUpdateGroupPath = (oldPath: string | undefined, newPath: string) => {
    const newQuestions = aiConfig.suggestedQuestions.map((q) => {
      const currentPath = typeof q === 'string' ? undefined : q.pathPattern;
      if (currentPath === oldPath) {
        return { ...(typeof q === 'string' ? { text: q } : q), pathPattern: newPath || undefined };
      }
      return q;
    });
    updateAIConfig({ suggestedQuestions: newQuestions });
    setEditingPath(null);
  };

  const handleRemoveGroup = (pathPattern: string | undefined) => {
    updateAIConfig({
      suggestedQuestions: aiConfig.suggestedQuestions.filter((q) => {
        const currentPath = typeof q === 'string' ? undefined : q.pathPattern;
        return currentPath !== pathPattern;
      }),
    });
  };

  const startEditingPath = (pathPattern: string | undefined) => {
    setEditingPath(pathPattern ?? '__all__');
    setEditingPathValue(pathPattern || '');
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
              placeholder="Assistant"
            />
            <p className="text-xs text-muted-foreground">
              Label used for Chat button
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
              placeholder="Ask anything..."
            />
          </div>

          <Separator />

          {/* Suggested Questions */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Suggested Questions</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Organize questions by page path. Questions without a path show on all pages.
                </p>
              </div>
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={() => setShowNewPathInput(true)}
              >
                <Plus className="h-4 w-4" />
                Add Path Group
              </Button>
            </div>

            {/* New Path Group Input */}
            {showNewPathInput && (
              <div className="flex items-center gap-2 p-3 rounded-lg border border-dashed bg-muted/30">
                <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                <Input
                  value={newPathInput}
                  onChange={(e) => setNewPathInput(e.target.value)}
                  placeholder="Enter path pattern (e.g., /pricing, /blog/*)"
                  className="flex-1 h-8"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddNewPathGroup();
                    if (e.key === 'Escape') {
                      setShowNewPathInput(false);
                      setNewPathInput('');
                    }
                  }}
                />
                <Button type="button" size="sm" onClick={handleAddNewPathGroup}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => {
                    setShowNewPathInput(false);
                    setNewPathInput('');
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            {questionGroups.length === 0 && !showNewPathInput ? (
              <div className="text-center py-8 border rounded-lg border-dashed">
                <p className="text-sm text-muted-foreground mb-3">No suggested questions added.</p>
                <div className="flex items-center justify-center gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleAddQuestionToGroup(undefined)}
                  >
                    <Plus className="h-4 w-4" />
                    Add for All Pages
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setShowNewPathInput(true)}
                  >
                    <FolderOpen className="h-4 w-4" />
                    Add for Specific Path
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {questionGroups.map((group) => {
                  const groupKey = group.pathPattern ?? '__all__';
                  const isEditing = editingPath === groupKey;
                  
                  return (
                    <div key={groupKey} className="rounded-lg border overflow-hidden">
                      {/* Group Header */}
                      <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b">
                        <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                        {isEditing ? (
                          <Input
                            value={editingPathValue}
                            onChange={(e) => setEditingPathValue(e.target.value)}
                            placeholder="Path pattern (empty for all pages)"
                            className="flex-1 h-7 text-sm"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleUpdateGroupPath(group.pathPattern, editingPathValue);
                              if (e.key === 'Escape') setEditingPath(null);
                            }}
                          />
                        ) : (
                          <span className="flex-1 text-sm font-medium">
                            {group.pathPattern || 'All pages'}
                          </span>
                        )}
                        {isEditing ? (
                          <>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => handleUpdateGroupPath(group.pathPattern, editingPathValue)}
                            >
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => setEditingPath(null)}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => startEditingPath(group.pathPattern)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                              onClick={() => handleRemoveGroup(group.pathPattern)}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>

                      {/* Questions in Group */}
                      <div className="p-2 space-y-2">
                        {group.questions.map(({ question, originalIndex }, qIndex) => (
                          <div key={originalIndex} className="flex items-center gap-2">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground">
                              {qIndex + 1}
                            </span>
                            <Input
                              value={question.text}
                              onChange={(e) => handleUpdateQuestionText(originalIndex, e.target.value)}
                              placeholder="Enter a suggested question..."
                              className="flex-1 h-8 text-sm"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                              onClick={() => handleRemoveQuestion(originalIndex)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                        
                        {/* Add Question to Group Button */}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="w-full h-8 text-muted-foreground hover:text-foreground border border-dashed"
                          onClick={() => handleAddQuestionToGroup(group.pathPattern)}
                        >
                          <Plus className="h-3.5 w-3.5 mr-1" />
                          Add question
                        </Button>
                      </div>
                    </div>
                  );
                })}
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
