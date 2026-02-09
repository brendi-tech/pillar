'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { getThemePreset, getThemeCSSVariables, type ThemeId, THEME_PRESETS } from '@/lib/themes';

/**
 * Inner component that reads search params and applies theme override
 */
function ThemePreviewOverride() {
  const searchParams = useSearchParams();
  const previewTheme = searchParams.get('preview_theme') as ThemeId | null;

  useEffect(() => {
    if (!previewTheme || !THEME_PRESETS[previewTheme]) {
      return;
    }

    const theme = getThemePreset(previewTheme);
    const lightVars = getThemeCSSVariables(theme, false);
    const darkVars = getThemeCSSVariables(theme, true);

    // Create and inject a style element
    const styleEl = document.createElement('style');
    styleEl.id = 'theme-preview-override';
    styleEl.textContent = `:root { ${lightVars} } .dark { ${darkVars} }`;
    document.head.appendChild(styleEl);

    // Cleanup on unmount or when preview theme changes
    return () => {
      const existingStyle = document.getElementById('theme-preview-override');
      if (existingStyle) {
        existingStyle.remove();
      }
    };
  }, [previewTheme]);

  return null;
}

/**
 * Client component that detects ?preview_theme=xxx in the URL
 * and temporarily overrides the CSS variables for that theme.
 */
export function ThemePreviewProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <ThemePreviewOverride />
      </Suspense>
      {children}
    </>
  );
}
