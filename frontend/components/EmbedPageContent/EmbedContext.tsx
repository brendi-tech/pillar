'use client';

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { EmbedConfig } from '@/types/config';
import { DEFAULT_EMBED_CONFIG } from '@/types/config';

interface EmbedContextValue {
  embedConfig: EmbedConfig;
  hasChanges: boolean;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  updateEmbedConfig: (updates: Partial<EmbedConfig>) => void;
  resetEmbedConfig: () => void;
  setLoading: (loading: boolean) => void;
  setSaving: (saving: boolean) => void;
  setError: (error: string | null) => void;
  helpCenterSlug: string;
  publicKey: string;
}

export const EmbedContext = createContext<EmbedContextValue | undefined>(undefined);

interface EmbedProviderProps {
  children: React.ReactNode;
  initialConfig?: EmbedConfig;
  helpCenterSlug: string;
  publicKey?: string;
}

export function EmbedProvider({ 
  children, 
  initialConfig, 
  helpCenterSlug,
  publicKey = '',
}: EmbedProviderProps) {
  const defaultConfig = initialConfig || DEFAULT_EMBED_CONFIG;
  const [embedConfig, setEmbedConfig] = useState<EmbedConfig>(defaultConfig);
  const [originalConfig] = useState<EmbedConfig>(defaultConfig);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasChanges = useMemo(
    () => JSON.stringify(embedConfig) !== JSON.stringify(originalConfig),
    [embedConfig, originalConfig]
  );

  const updateEmbedConfig = useCallback((updates: Partial<EmbedConfig>) => {
    setEmbedConfig((prev) => ({
      ...prev,
      ...updates,
    }));
  }, []);

  const resetEmbedConfig = useCallback(() => {
    setEmbedConfig(originalConfig);
    setError(null);
  }, [originalConfig]);

  const setLoading = useCallback((loading: boolean) => {
    setIsLoading(loading);
  }, []);

  const setSaving = useCallback((saving: boolean) => {
    setIsSaving(saving);
  }, []);

  const value: EmbedContextValue = useMemo(
    () => ({
      embedConfig,
      hasChanges,
      isLoading,
      isSaving,
      error,
      updateEmbedConfig,
      resetEmbedConfig,
      setLoading,
      setSaving,
      setError,
      helpCenterSlug,
      publicKey,
    }),
    [
      embedConfig,
      hasChanges,
      isLoading,
      isSaving,
      error,
      updateEmbedConfig,
      resetEmbedConfig,
      setLoading,
      setSaving,
      helpCenterSlug,
      publicKey,
    ]
  );

  return <EmbedContext.Provider value={value}>{children}</EmbedContext.Provider>;
}

export function useEmbed() {
  const context = useContext(EmbedContext);
  if (context === undefined) {
    throw new Error('useEmbed must be used within an EmbedProvider');
  }
  return context;
}

