/**
 * Shared constants for Remotion technical demo videos.
 */

// Video dimensions and timing
export const VIDEO_WIDTH = 1920;
export const VIDEO_HEIGHT = 1080;
export const VIDEO_FPS = 30;
export const TOTAL_DURATION_FRAMES = 540; // 18 seconds

// Layout
export const LEFT_COLUMN_WIDTH = 520;
export const PADDING = 60;

// Timing phases (in frames)
export const PROMPT_APPEAR_FRAMES = 30; // 1s for prompt to appear
export const PROMPT_PAUSE_FRAMES = 30; // 1s pause before steps start
export const STEPS_START_FRAME = PROMPT_APPEAR_FRAMES + PROMPT_PAUSE_FRAMES; // frame 60
export const COMPLETION_HOLD_FRAMES = 30; // 1s at end showing all complete

// Actor display config
export const ACTOR_CONFIG = {
  user: {
    label: "USER",
    color: "#6B7280",
    bgColor: "#F3F4F6",
    icon: "💬",
  },
  pillar: {
    label: "PILLAR",
    color: "#FF6E00",
    bgColor: "#FFF7ED",
    icon: "⚡",
  },
  app: {
    label: "YOUR APP",
    color: "#059669",
    bgColor: "#ECFDF5",
    icon: "→",
  },
  done: {
    label: "DONE",
    color: "#10B981",
    bgColor: "#ECFDF5",
    icon: "✓",
  },
} as const;

// Colors
export const COLORS = {
  background: "#FAFAFA",
  // Step states
  pending: {
    text: "#D1D5DB",
    line: "#E5E7EB",
    circle: "#E5E7EB",
  },
  active: {
    glow: "rgba(255, 110, 0, 0.1)",
  },
  completed: {
    check: "#10B981",
    text: "#9CA3AF",
    line: "#10B981",
  },
  // Prompt header
  prompt: {
    background: "#FFFFFF",
    text: "#1A1A1A",
    label: "#6B7280",
    border: "#E5E7EB",
  },
  // Wireframe
  wireframe: {
    background: "#FFFFFF",
    border: "#E5E7EB",
    placeholder: "#F3F4F6",
    placeholderDark: "#E5E7EB",
    accent: "#FF6E00",
    text: "#374151",
    textLight: "#9CA3AF",
  },
} as const;

// Typography — scaled up for readability at video resolution
export const FONTS = {
  mono: "SF Mono, Monaco, Menlo, Consolas, monospace",
  sans: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
} as const;
