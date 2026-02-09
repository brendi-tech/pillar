'use client';

/**
 * ThemeSelectorModal
 * 
 * A modal for quickly switching between theme presets.
 * Can be triggered from anywhere via the global store.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Anchor,
  ArrowUpRight,
  Check,
  Compass,
  Leaf,
  Navigation,
  Terminal,
} from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { THEME_PRESETS, getThemePreset, type ThemeId } from '@/lib/themes';
import { cn } from '@/lib/utils';
import { useProduct } from '@/providers/ProductProvider';
import { configKeys, helpCenterConfigQuery, updateConfigMutation } from '@/queries/config.queries';
import { useThemeSelectorModal } from './useThemeSelectorModal';

const THEME_ICONS: Record<ThemeId, React.ElementType> = {
  compass: Compass,
  harbor: Anchor,
  meridian: Leaf,
  vector: ArrowUpRight,
  anchor: Navigation,
  terminal: Terminal,
};

export function ThemeSelectorModal() {
  const { isOpen, close } = useThemeSelectorModal();
  const { currentProductId } = useProduct();
  const queryClient = useQueryClient();

  // Fetch current config to get current theme
  const { data: config } = useQuery({
    ...helpCenterConfigQuery(currentProductId || ''),
    enabled: !!currentProductId && isOpen,
  });

  const currentTheme = (config?.theme as ThemeId) || 'compass';

  // Mutation to update theme - don't auto-close so user can try different themes
  const updateTheme = useMutation({
    ...updateConfigMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: configKeys.all });
    },
  });

  const handleThemeChange = (themeId: ThemeId) => {
    if (!currentProductId) return;

    const theme = getThemePreset(themeId);
    updateTheme.mutate({
      siteId: currentProductId,
      payload: {
        theme: themeId,
        layout: {
          style: theme.defaultLayout,
          gridColumns: theme.defaultGridColumns,
        },
      },
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Choose a Theme</DialogTitle>
          <DialogDescription>
            Select a theme preset that matches your brand personality.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 py-4 md:grid-cols-3">
          {Object.values(THEME_PRESETS).map((theme) => {
            const ThemeIcon = THEME_ICONS[theme.id];
            const isSelected = currentTheme === theme.id;
            const isLoading = updateTheme.isPending && updateTheme.variables?.payload?.theme === theme.id;

            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => handleThemeChange(theme.id)}
                disabled={updateTheme.isPending}
                className={cn(
                  'relative flex flex-col items-start gap-3 rounded-xl border-2 p-4 text-left transition-all',
                  isSelected
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border hover:border-primary/50',
                  updateTheme.isPending && 'opacity-50 cursor-not-allowed'
                )}
              >
                {/* Theme Preview Bar */}
                <div
                  className="flex h-8 w-full items-center gap-2 rounded-md px-2"
                  style={{ backgroundColor: theme.colors.light.surface }}
                >
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: theme.colors.light.primary }}
                  />
                  <div
                    className="h-2 flex-1 rounded"
                    style={{ backgroundColor: theme.colors.light.border }}
                  />
                </div>

                {/* Theme Info */}
                <div className="flex w-full items-start gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                    style={{
                      backgroundColor: theme.colors.light.primary + '15',
                      color: theme.colors.light.primary,
                    }}
                  >
                    <ThemeIcon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{theme.name}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {theme.tagline}
                    </p>
                  </div>
                </div>

                {/* Selected Indicator */}
                {isSelected && !isLoading && (
                  <div className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-3 w-3" />
                  </div>
                )}

                {/* Loading Indicator */}
                {isLoading && (
                  <div className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
