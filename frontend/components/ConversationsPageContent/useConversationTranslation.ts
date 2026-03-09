import { useState, useCallback, useEffect, useRef } from 'react';
import type { ChatMessage } from '@/types/admin';

interface TranslationState {
  isTranslated: boolean;
  isTranslating: boolean;
  detectedLanguage: string | null;
  hasNonEnglishContent: boolean;
  translations: Record<string, string>;
  error: string | null;
}

const NON_LATIN_REGEX =
  /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\u0400-\u04FF\u0900-\u097F\u0590-\u05FF\u0E00-\u0E7F\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/;

function containsNonLatinText(text: string): boolean {
  return NON_LATIN_REGEX.test(text);
}

function getLanguageName(code: string): string {
  try {
    const displayNames = new Intl.DisplayNames(['en'], { type: 'language' });
    return displayNames.of(code) || code;
  } catch {
    return code;
  }
}

declare class Translator {
  static availability(options: {
    sourceLanguage: string;
    targetLanguage: string;
  }): Promise<'available' | 'downloading' | 'downloadable' | 'unavailable'>;
  static create(options: {
    sourceLanguage: string;
    targetLanguage: string;
  }): Promise<Translator>;
  translate(text: string): Promise<string>;
}

declare class LanguageDetector {
  static availability(): Promise<'available' | 'downloading' | 'downloadable' | 'unavailable'>;
  static create(): Promise<LanguageDetector>;
  detect(text: string): Promise<Array<{ detectedLanguage: string; confidence: number }>>;
}

export function useConversationTranslation(messages: ChatMessage[] | undefined) {
  const [state, setState] = useState<TranslationState>({
    isTranslated: false,
    isTranslating: false,
    detectedLanguage: null,
    hasNonEnglishContent: false,
    translations: {},
    error: null,
  });

  const translatorRef = useRef<Translator | null>(null);
  const messagesKeyRef = useRef<string>('');

  useEffect(() => {
    if (!messages || messages.length === 0) {
      setState((prev) => ({
        ...prev,
        hasNonEnglishContent: false,
        detectedLanguage: null,
      }));
      return;
    }

    const newKey = messages.map((m) => m.id).join(',');
    if (newKey === messagesKeyRef.current) return;
    messagesKeyRef.current = newKey;

    const hasNonEnglish = messages.some(
      (m) => m.content && containsNonLatinText(m.content)
    );

    setState((prev) => ({
      ...prev,
      hasNonEnglishContent: hasNonEnglish,
      isTranslated: false,
      translations: {},
      error: null,
    }));

    if (hasNonEnglish) {
      detectLanguage(messages);
    }
  }, [messages]);

  async function detectLanguage(msgs: ChatMessage[]) {
    try {
      if (!('LanguageDetector' in self)) return;

      const availability = await LanguageDetector.availability();
      if (availability === 'unavailable') return;

      const detector = await LanguageDetector.create();
      const sampleText =
        msgs.find((m) => m.content && containsNonLatinText(m.content))
          ?.content || '';
      if (!sampleText) return;

      const results = await detector.detect(sampleText);
      if (results?.[0]) {
        setState((prev) => ({
          ...prev,
          detectedLanguage: results[0].detectedLanguage,
        }));
      }
    } catch {
      // Language detection not available
    }
  }

  const translate = useCallback(async () => {
    if (!messages || state.isTranslating) return;

    setState((prev) => ({ ...prev, isTranslating: true, error: null }));

    try {
      if (!('Translator' in self)) {
        setState((prev) => ({
          ...prev,
          isTranslating: false,
          error:
            'Built-in translation is not available in this browser. Use Chrome 138+ or right-click the page and select "Translate to English".',
        }));
        return;
      }

      const sourceLang = state.detectedLanguage || 'ar';
      const availability = await Translator.availability({
        sourceLanguage: sourceLang,
        targetLanguage: 'en',
      });

      if (availability === 'unavailable') {
        setState((prev) => ({
          ...prev,
          isTranslating: false,
          error:
            'Translation for this language pair is not available. Try right-clicking the page and selecting "Translate to English".',
        }));
        return;
      }

      const translator = await Translator.create({
        sourceLanguage: sourceLang,
        targetLanguage: 'en',
      });
      translatorRef.current = translator;

      const translations: Record<string, string> = {};

      for (const message of messages) {
        if (message.content && containsNonLatinText(message.content)) {
          translations[message.id] = await translator.translate(
            message.content
          );
        }
      }

      setState((prev) => ({
        ...prev,
        isTranslated: true,
        isTranslating: false,
        translations,
      }));
    } catch {
      setState((prev) => ({
        ...prev,
        isTranslating: false,
        error:
          'Translation failed. Try right-clicking the page and selecting "Translate to English".',
      }));
    }
  }, [messages, state.detectedLanguage, state.isTranslating]);

  const untranslate = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isTranslated: false,
      translations: {},
      error: null,
    }));
  }, []);

  const getTranslatedContent = useCallback(
    (messageId: string, originalContent: string): string => {
      if (state.isTranslated && state.translations[messageId]) {
        return state.translations[messageId];
      }
      return originalContent;
    },
    [state.isTranslated, state.translations]
  );

  return {
    ...state,
    translate,
    untranslate,
    getTranslatedContent,
    languageName: state.detectedLanguage
      ? getLanguageName(state.detectedLanguage)
      : null,
  };
}
