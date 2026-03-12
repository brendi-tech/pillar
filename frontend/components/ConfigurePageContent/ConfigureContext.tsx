'use client';

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { EmbedConfig, AIConfig } from '@/types/config';
import { DEFAULT_EMBED_CONFIG } from '@/types/config';
import type { LanguageCode } from '@/types/v2/products';

export interface ConfigureContextValue {
  // AI Config
  aiConfig: AIConfig;
  updateAIConfig: (updates: Partial<AIConfig>) => void;
  
  // Embed Config
  embedConfig: EmbedConfig;
  updateEmbedConfig: (updates: Partial<EmbedConfig>) => void;
  
  // Product-level settings
  defaultLanguage: LanguageCode;
  updateDefaultLanguage: (language: LanguageCode) => void;
  
  // Agent Guidance (product-specific instructions for the AI agent)
  agentGuidance: string;
  updateAgentGuidance: (guidance: string) => void;
  
  // State
  hasChanges: boolean;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  setSaving: (saving: boolean) => void;
  setError: (error: string | null) => void;
  resetChanges: () => void;
  markAsSaved: () => void;
  
  // Help Center Info
  helpCenterId: string;
  helpCenterSlug: string;
}

const ConfigureContext = createContext<ConfigureContextValue | undefined>(undefined);

const DEFAULT_AI_CONFIG: AIConfig = {
  enabled: true,
  assistantName: 'Copilot',
  welcomeMessage: 'Hi! How can I help you today?',
  inputPlaceholder: 'Ask anything...',
  suggestedQuestions: [],
  openOnLoad: false,
};

interface ConfigureProviderProps {
  children: React.ReactNode;
  helpCenterId: string;
  helpCenterSlug: string;
  initialAIConfig?: AIConfig;
  initialEmbedConfig?: EmbedConfig;
  initialDefaultLanguage?: LanguageCode;
  initialAgentGuidance?: string;
}

export function ConfigureProvider({
  children,
  helpCenterId,
  helpCenterSlug,
  initialAIConfig,
  initialEmbedConfig,
  initialDefaultLanguage,
  initialAgentGuidance,
}: ConfigureProviderProps) {
  // Initialize state with defaults or initial values
  const [aiConfig, setAIConfig] = useState<AIConfig>(
    initialAIConfig || DEFAULT_AI_CONFIG
  );
  const [originalAIConfig, setOriginalAIConfig] = useState<AIConfig>(
    initialAIConfig || DEFAULT_AI_CONFIG
  );
  
  const [embedConfig, setEmbedConfig] = useState<EmbedConfig>(
    initialEmbedConfig || DEFAULT_EMBED_CONFIG
  );
  const [originalEmbedConfig, setOriginalEmbedConfig] = useState<EmbedConfig>(
    initialEmbedConfig || DEFAULT_EMBED_CONFIG
  );
  
  const [defaultLanguage, setDefaultLanguage] = useState<LanguageCode>(
    initialDefaultLanguage || 'auto'
  );
  const [originalDefaultLanguage, setOriginalDefaultLanguage] = useState<LanguageCode>(
    initialDefaultLanguage || 'auto'
  );
  
  const [agentGuidance, setAgentGuidance] = useState<string>(
    initialAgentGuidance || ''
  );
  const [originalAgentGuidance, setOriginalAgentGuidance] = useState<string>(
    initialAgentGuidance || ''
  );
  
  const [isLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if any config has changed
  const hasChanges = useMemo(() => {
    return (
      JSON.stringify(aiConfig) !== JSON.stringify(originalAIConfig) ||
      JSON.stringify(embedConfig) !== JSON.stringify(originalEmbedConfig) ||
      defaultLanguage !== originalDefaultLanguage ||
      agentGuidance !== originalAgentGuidance
    );
  }, [aiConfig, originalAIConfig, embedConfig, originalEmbedConfig, defaultLanguage, originalDefaultLanguage, agentGuidance, originalAgentGuidance]);

  const updateAIConfig = useCallback((updates: Partial<AIConfig>) => {
    setAIConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  const updateEmbedConfig = useCallback((updates: Partial<EmbedConfig>) => {
    setEmbedConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  const updateDefaultLanguage = useCallback((language: LanguageCode) => {
    setDefaultLanguage(language);
  }, []);

  const updateAgentGuidance = useCallback((guidance: string) => {
    setAgentGuidance(guidance);
  }, []);

  const setSaving = useCallback((saving: boolean) => {
    setIsSaving(saving);
  }, []);

  const resetChanges = useCallback(() => {
    setAIConfig(originalAIConfig);
    setEmbedConfig(originalEmbedConfig);
    setDefaultLanguage(originalDefaultLanguage);
    setAgentGuidance(originalAgentGuidance);
  }, [originalAIConfig, originalEmbedConfig, originalDefaultLanguage, originalAgentGuidance]);

  const markAsSaved = useCallback(() => {
    setOriginalAIConfig(aiConfig);
    setOriginalEmbedConfig(embedConfig);
    setOriginalDefaultLanguage(defaultLanguage);
    setOriginalAgentGuidance(agentGuidance);
  }, [aiConfig, embedConfig, defaultLanguage, agentGuidance]);

  const value: ConfigureContextValue = useMemo(
    () => ({
      aiConfig,
      updateAIConfig,
      embedConfig,
      updateEmbedConfig,
      defaultLanguage,
      updateDefaultLanguage,
      agentGuidance,
      updateAgentGuidance,
      hasChanges,
      isLoading,
      isSaving,
      error,
      setSaving,
      setError,
      resetChanges,
      markAsSaved,
      helpCenterId,
      helpCenterSlug,
    }),
    [
      aiConfig,
      updateAIConfig,
      embedConfig,
      updateEmbedConfig,
      defaultLanguage,
      updateDefaultLanguage,
      agentGuidance,
      updateAgentGuidance,
      hasChanges,
      isLoading,
      isSaving,
      error,
      setSaving,
      resetChanges,
      markAsSaved,
      helpCenterId,
      helpCenterSlug,
    ]
  );

  return (
    <ConfigureContext.Provider value={value}>
      {children}
    </ConfigureContext.Provider>
  );
}

export function useConfigure() {
  const context = useContext(ConfigureContext);
  if (context === undefined) {
    throw new Error('useConfigure must be used within a ConfigureProvider');
  }
  return context;
}
