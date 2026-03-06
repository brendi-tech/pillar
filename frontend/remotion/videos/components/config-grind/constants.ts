export const WIDTH = 1920;
export const HEIGHT = 1080;
export const FPS = 30;
export const DURATION = FPS * 18; // 18 seconds

export const FONT =
  'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
export const MONO_FONT =
  '"SF Mono", "Fira Code", "Fira Mono", "Roboto Mono", monospace';

export const COLORS = {
  bg: "#FAFAFA",
  surface: "#FFFFFF",
  border: "#E5E7EB",
  borderLight: "#F3F4F6",
  text: "#1A1A1A",
  textMuted: "#6B7280",
  textLight: "#9CA3AF",
  accent: "#FF6E00",
  accentRgb: "255, 110, 0",
  red: "#EF4444",
  redLight: "#FEE2E2",
  green: "#10B981",
  greenLight: "#D1FAE5",
  dropdown: "#F9FAFB",
} as const;

// The 23 clicks to build ONE trigger in a helpdesk admin UI
export const CLICK_STEPS = [
  { area: "sidebar", label: "Admin Center" },
  { area: "sidebar", label: "Objects and rules" },
  { area: "sidebar", label: "Triggers" },
  { area: "main", label: "Add trigger" },
  { area: "form", label: "Name: \"Route billing tickets\"" },
  { area: "form", label: "+ Add condition" },
  { area: "dropdown", label: "Ticket: Subject" },
  { area: "dropdown", label: "Contains" },
  { area: "input", label: "\"billing\"" },
  { area: "form", label: "+ Add condition" },
  { area: "dropdown", label: "Ticket: Subject" },
  { area: "dropdown", label: "Contains" },
  { area: "input", label: "\"invoice\"" },
  { area: "form", label: "+ Add condition" },
  { area: "dropdown", label: "Ticket: Subject" },
  { area: "dropdown", label: "Contains" },
  { area: "input", label: "\"payment\"" },
  { area: "scroll", label: "Scroll to actions" },
  { area: "form", label: "+ Add action" },
  { area: "dropdown", label: "Ticket: Priority → High" },
  { area: "form", label: "+ Add action" },
  { area: "dropdown", label: "Ticket: Group → Finance" },
  { area: "button", label: "Save" },
] as const;

export const PILLAR_PROMPT =
  "Route all billing, invoice, and payment tickets to Finance with high priority";

// Scene timing (in frames)
export const SCENES = {
  // Act 1: The grind
  titleIn: 0,
  triggerUIIn: FPS * 1.5, // 1.5s
  clicksStart: FPS * 2.5, // 2.5s
  clicksEnd: FPS * 10, // 10s — speed through all 23 clicks
  counterHold: FPS * 10.5,
  grindFadeOut: FPS * 11,

  // Transition
  questionIn: FPS * 11.5,
  questionOut: FPS * 13,

  // Act 2: The sentence
  pillarIn: FPS * 13,
  typingStart: FPS * 13.5,
  typingEnd: FPS * 15.5,
  stepsStart: FPS * 15.5,
  doneAt: FPS * 16.5,

  // Closing
  closingIn: FPS * 17,
} as const;
