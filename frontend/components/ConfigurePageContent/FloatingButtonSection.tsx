'use client';

import { useConfigure } from './ConfigureContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { CircleHelp, MessageCircle } from 'lucide-react';
import type { FloatingButtonPosition } from '@/types/config';

const POSITIONS: { value: FloatingButtonPosition; label: string }[] = [
  { value: 'top-left', label: 'Top Left' },
  { value: 'top-right', label: 'Top Right' },
  { value: 'bottom-left', label: 'Bottom Left' },
  { value: 'bottom-right', label: 'Bottom Right' },
];

export function FloatingButtonSection() {
  const { embedConfig, updateEmbedConfig } = useConfigure();
  const floatingButton = embedConfig.floatingButton;

  const handleEnabledChange = (enabled: boolean) => {
    updateEmbedConfig({
      floatingButton: { ...floatingButton, enabled },
    });
  };

  const handlePositionChange = (position: FloatingButtonPosition) => {
    updateEmbedConfig({
      floatingButton: { ...floatingButton, position },
    });
  };

  const handleLabelChange = (label: string) => {
    updateEmbedConfig({
      floatingButton: { ...floatingButton, label },
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CircleHelp className="h-5 w-5" />
              Floating Button
            </CardTitle>
            <CardDescription>
              Add a floating help button that opens the panel
            </CardDescription>
          </div>
          <Switch
            checked={floatingButton.enabled}
            onCheckedChange={handleEnabledChange}
          />
        </div>
      </CardHeader>

      {floatingButton.enabled && (
        <CardContent className="space-y-6">
          {/* Position Picker */}
          <div className="space-y-3">
            <Label>Button Position</Label>
            <div className="grid grid-cols-2 gap-2">
              {POSITIONS.map((pos) => (
                <button
                  key={pos.value}
                  type="button"
                  onClick={() => handlePositionChange(pos.value)}
                  className={cn(
                    'flex items-center justify-center p-3 rounded-lg border-2 transition-all',
                    'hover:border-primary/50 hover:bg-muted/50',
                    floatingButton.position === pos.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-background'
                  )}
                >
                  <span className="text-sm">{pos.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Button Label */}
          <div className="space-y-3">
            <Label htmlFor="button-label">Button Label</Label>
            <Input
              id="button-label"
              value={floatingButton.label}
              onChange={(e) => handleLabelChange(e.target.value)}
              placeholder="Help"
              maxLength={20}
            />
            <p className="text-xs text-muted-foreground">
              Text shown on the floating button (max 20 characters)
            </p>
          </div>

          {/* Preview */}
          <div className="space-y-3">
            <Label>Preview</Label>
            <div className="relative h-40 border border-border rounded-lg bg-muted/30 overflow-hidden">
              {/* Simulated floating button */}
              <div
                className={cn(
                  'absolute flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground shadow-lg text-sm font-medium',
                  {
                    'top-3 left-3': floatingButton.position === 'top-left',
                    'top-3 right-3': floatingButton.position === 'top-right',
                    'bottom-3 left-3': floatingButton.position === 'bottom-left',
                    'bottom-3 right-3': floatingButton.position === 'bottom-right',
                  }
                )}
              >
                <MessageCircle className="h-4 w-4" />
                {floatingButton.label || 'Help'}
              </div>

              {/* Simulated app content */}
              <div className="p-4">
                <div className="h-3 w-32 bg-muted rounded mb-3" />
                <div className="h-2 w-full bg-muted/60 rounded mb-1.5" />
                <div className="h-2 w-4/5 bg-muted/60 rounded mb-1.5" />
                <div className="h-2 w-3/4 bg-muted/60 rounded mb-4" />
                <div className="h-8 w-24 bg-muted rounded" />
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
