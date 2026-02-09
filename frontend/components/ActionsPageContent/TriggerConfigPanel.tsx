'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, X } from 'lucide-react';
import { useState } from 'react';

interface TriggerConfigPanelProps {
  keywords: string[];
  intents: string[];
  onKeywordsChange: (keywords: string[]) => void;
  onIntentsChange: (intents: string[]) => void;
}

export function TriggerConfigPanel({
  keywords,
  intents,
  onKeywordsChange,
  onIntentsChange,
}: TriggerConfigPanelProps) {
  const [newKeyword, setNewKeyword] = useState('');
  const [newIntent, setNewIntent] = useState('');

  const addKeyword = () => {
    const trimmed = newKeyword.trim().toLowerCase();
    if (trimmed && !keywords.includes(trimmed)) {
      onKeywordsChange([...keywords, trimmed]);
      setNewKeyword('');
    }
  };

  const removeKeyword = (keyword: string) => {
    onKeywordsChange(keywords.filter((k) => k !== keyword));
  };

  const addIntent = () => {
    const trimmed = newIntent.trim().toLowerCase().replace(/\s+/g, '_');
    if (trimmed && !intents.includes(trimmed)) {
      onIntentsChange([...intents, trimmed]);
      setNewIntent('');
    }
  };

  const removeIntent = (intent: string) => {
    onIntentsChange(intents.filter((i) => i !== intent));
  };

  return (
    <div className="space-y-6">
      {/* Keywords */}
      <div className="space-y-3">
        <Label>Trigger Keywords</Label>
        <p className="text-xs text-muted-foreground">
          Words or phrases that should trigger this action suggestion
        </p>
        
        <div className="flex gap-2">
          <Input
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            placeholder="e.g., invite team"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addKeyword();
              }
            }}
          />
          <Button type="button" variant="outline" onClick={addKeyword}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {keywords.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {keywords.map((keyword) => (
              <Badge key={keyword} variant="secondary" className="gap-1 pr-1">
                {keyword}
                <button
                  type="button"
                  onClick={() => removeKeyword(keyword)}
                  className="ml-1 rounded-full p-0.5 hover:bg-muted"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Intents */}
      <div className="space-y-3">
        <Label>Trigger Intents</Label>
        <p className="text-xs text-muted-foreground">
          Semantic intents that match this action (e.g., &quot;invite_user&quot;, &quot;change_plan&quot;)
        </p>
        
        <div className="flex gap-2">
          <Input
            value={newIntent}
            onChange={(e) => setNewIntent(e.target.value)}
            placeholder="e.g., invite_user"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addIntent();
              }
            }}
          />
          <Button type="button" variant="outline" onClick={addIntent}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {intents.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {intents.map((intent) => (
              <Badge key={intent} variant="outline" className="gap-1 pr-1">
                {intent}
                <button
                  type="button"
                  onClick={() => removeIntent(intent)}
                  className="ml-1 rounded-full p-0.5 hover:bg-muted"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
