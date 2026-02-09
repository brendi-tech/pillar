'use client';

import { useEmbed } from './EmbedContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { PanelLeft, PanelRight } from 'lucide-react';
import type { PanelPosition } from '@/types/config';

export function PanelSettings() {
  const { embedConfig, updateEmbedConfig } = useEmbed();
  const panel = embedConfig.panel;

  const handleEnabledChange = (enabled: boolean) => {
    updateEmbedConfig({
      panel: { ...panel, enabled },
    });
  };

  const handlePositionChange = (position: string) => {
    if (position === 'left' || position === 'right') {
      updateEmbedConfig({
        panel: { ...panel, position: position as PanelPosition },
      });
    }
  };

  const handleWidthChange = (value: number[]) => {
    updateEmbedConfig({
      panel: { ...panel, width: value[0] },
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <PanelRight className="h-5 w-5" />
              Help Panel
            </CardTitle>
            <CardDescription>
              Configure the slide-out help panel behavior
            </CardDescription>
          </div>
          <Switch
            checked={panel.enabled}
            onCheckedChange={handleEnabledChange}
          />
        </div>
      </CardHeader>

      {panel.enabled && (
        <CardContent className="space-y-6">
          {/* Position */}
          <div className="space-y-3">
            <Label>Panel Position</Label>
            <ToggleGroup
              type="single"
              value={panel.position}
              onValueChange={handlePositionChange}
              className="justify-start"
            >
              <ToggleGroupItem value="left" aria-label="Left side" className="gap-2">
                <PanelLeft className="h-4 w-4" />
                Left
              </ToggleGroupItem>
              <ToggleGroupItem value="right" aria-label="Right side" className="gap-2">
                <PanelRight className="h-4 w-4" />
                Right
              </ToggleGroupItem>
            </ToggleGroup>
            <p className="text-xs text-muted-foreground">
              The panel will overlay content on the {panel.position} side of the screen
            </p>
          </div>

          {/* Width */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Panel Width</Label>
              <span className="text-sm font-mono text-muted-foreground">
                {panel.width}px
              </span>
            </div>
            <Slider
              value={[panel.width]}
              onValueChange={handleWidthChange}
              min={320}
              max={480}
              step={10}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>320px</span>
              <span>480px</span>
            </div>
          </div>

          {/* Preview */}
          <div className="space-y-3">
            <Label>Preview</Label>
            <div className="relative h-32 border border-border rounded-lg bg-muted/30 overflow-hidden">
              {/* Simulated app content */}
              <div className="absolute inset-0 p-3">
                <div className="h-3 w-24 bg-muted rounded mb-2" />
                <div className="h-2 w-full bg-muted/60 rounded mb-1" />
                <div className="h-2 w-3/4 bg-muted/60 rounded mb-1" />
                <div className="h-2 w-5/6 bg-muted/60 rounded" />
              </div>
              
              {/* Simulated panel */}
              <div
                className={`absolute top-0 bottom-0 bg-background border-${panel.position === 'left' ? 'r' : 'l'} border-border shadow-lg transition-all duration-200`}
                style={{
                  width: `${(panel.width / 480) * 40}%`,
                  [panel.position]: 0,
                }}
              >
                <div className="p-2">
                  <div className="h-2 w-12 bg-primary/40 rounded mb-2" />
                  <div className="h-1.5 w-full bg-muted rounded mb-1" />
                  <div className="h-1.5 w-2/3 bg-muted rounded" />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

