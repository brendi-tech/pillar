'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ImageIcon, Palette, Upload, X } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { useConfigure } from './ConfigureContext';

export function BrandingSection() {
  const { branding, updateBranding } = useConfigure();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(branding.logoUrl || null);

  const handleNameChange = (value: string) => {
    updateBranding({ name: value });
  };

  const handleColorChange = (value: string) => {
    updateBranding({ primaryColor: value });
  };

  const handleLogoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Create preview URL
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    updateBranding({ logoUrl: url });
  }, [updateBranding]);

  const handleRemoveLogo = () => {
    setPreviewUrl(null);
    updateBranding({ logoUrl: undefined });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Card id="branding">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" />
          Branding
        </CardTitle>
        <CardDescription>
          Customize how your product assistant looks
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Assistant Name */}
        <div className="space-y-2">
          <Label htmlFor="assistant-name">Assistant Name</Label>
          <Input
            id="assistant-name"
            value={branding.name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="Product Assistant"
          />
          <p className="text-xs text-muted-foreground">
            Displayed in the help panel header
          </p>
        </div>

        {/* Logo Upload */}
        <div className="space-y-3">
          <Label>Logo</Label>
          <div className="flex items-center gap-4">
            {/* Preview */}
            <div className="flex h-16 w-32 items-center justify-center rounded-lg border border-dashed border-border bg-muted/30">
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img 
                  src={previewUrl} 
                  alt="Logo preview" 
                  className="max-h-12 max-w-28 object-contain"
                />
              ) : (
                <ImageIcon className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            
            {/* Upload / Remove buttons */}
            <div className="flex flex-col gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload Logo
              </Button>
              {previewUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveLogo}
                  className="text-destructive hover:text-destructive"
                >
                  <X className="h-4 w-4 mr-2" />
                  Remove
                </Button>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Recommended: 200x50px PNG or SVG with transparent background
          </p>
        </div>

        {/* Primary Color */}
        <div className="space-y-3">
          <Label htmlFor="primary-color">Primary Color</Label>
          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                type="color"
                id="primary-color"
                value={branding.primaryColor || '#6366f1'}
                onChange={(e) => handleColorChange(e.target.value)}
                className="h-10 w-16 cursor-pointer rounded-lg border border-border bg-background"
              />
            </div>
            <Input
              value={branding.primaryColor || '#6366f1'}
              onChange={(e) => handleColorChange(e.target.value)}
              placeholder="#6366f1"
              className="w-32 font-mono"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Used for buttons, links, and accent elements in the SDK
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
