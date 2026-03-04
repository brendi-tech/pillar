export const SECRET_REVEAL_DIMENSIONS = { width: 1920, height: 1080 };
export const SECRET_REVEAL_DURATION = 620; // ~20.7 seconds

export const SCENES = {
  title: { fadeOut: 70 },
  prompt: { start: 85, typingStart: 100, fadeOut: 163 },
  backend: { cardIn: 160, line1: 180, arrow: 200, line2: 213, badge: 235, fadeOut: 280 },
  chat: { panelIn: 275, messageIn: 295, buttonIn: 325, click: 375, fadeOut: 493 },
  reveal: { keyIn: 378, burnStart: 410, stampIn: 455 },
  summary: { cardIn: 488 },
  hold: { start: 533, end: 620 },
} as const;

export const PROMPT_TEXT = "Generate a dev API key";
export const API_KEY = "sk-live-a1b2c3d4e5f6";

export const COLORS = {
  background: "#FCFCFC",
  orange: "#FF6E00",
  orangeRgb: "255, 110, 0",
  green: "#10B981",
  greenRgb: "16, 185, 129",
  red: "#EF4444",
  redRgb: "239, 68, 68",
  textPrimary: "#1D1D1F",
  textMuted: "#86868B",
} as const;
