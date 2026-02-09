/**
 * Type definitions for OpenAI Apps SDK window.openai API
 * Based on: https://developers.openai.com/apps-sdk/build/custom-ux
 */

export type UnknownObject = Record<string, unknown>;

export type DisplayMode = 'pip' | 'inline' | 'fullscreen';
export type Theme = 'light' | 'dark';
export type DeviceType = 'mobile' | 'tablet' | 'desktop' | 'unknown';

export interface SafeAreaInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface SafeArea {
  insets: SafeAreaInsets;
}

export interface UserAgent {
  device: { type: DeviceType };
  capabilities: {
    hover: boolean;
    touch: boolean;
  };
}

export interface CallToolResponse {
  content: Array<{
    type: string;
    text?: string;
    [key: string]: unknown;
  }>;
  isError?: boolean;
  [key: string]: unknown;
}

export interface OpenAiGlobals<
  ToolInput extends UnknownObject = UnknownObject,
  ToolOutput extends UnknownObject = UnknownObject,
  ToolResponseMetadata extends UnknownObject = UnknownObject,
  WidgetState extends UnknownObject = UnknownObject
> {
  theme: Theme;
  userAgent: UserAgent;
  locale: string;
  maxHeight: number;
  displayMode: DisplayMode;
  safeArea: SafeArea;
  toolInput: ToolInput;
  toolOutput: ToolOutput | null;
  toolResponseMetadata: ToolResponseMetadata | null;
  widgetState: WidgetState | null;
}

export interface API<WidgetState extends UnknownObject = UnknownObject> {
  callTool: (
    name: string,
    args: Record<string, unknown>
  ) => Promise<CallToolResponse>;
  sendFollowUpMessage: (args: { prompt: string }) => Promise<void>;
  openExternal: (payload: { href: string }) => void;
  requestDisplayMode: (args: { mode: DisplayMode }) => Promise<{
    mode: DisplayMode;
  }>;
  setWidgetState: (state: WidgetState) => Promise<void>;
}

export const SET_GLOBALS_EVENT_TYPE = 'openai:set_globals';

export class SetGlobalsEvent extends CustomEvent<{
  globals: Partial<OpenAiGlobals>;
}> {
  readonly type = SET_GLOBALS_EVENT_TYPE;
}

declare global {
  interface Window {
    openai?: API<UnknownObject> & OpenAiGlobals;
  }

  interface WindowEventMap {
    [SET_GLOBALS_EVENT_TYPE]: SetGlobalsEvent;
  }
}

// Pillar-specific types

/**
 * Source from Pillar agent - can be a web page or uploaded document
 */
export interface Source {
  title: string;
  url: string | null;
  type: 'page' | 'document';
  source_type: string;
  score: number;
  citation_number?: number;
}

/**
 * Tool output structure for sources
 */
export interface SourcesToolOutput {
  sources: Source[];
}
