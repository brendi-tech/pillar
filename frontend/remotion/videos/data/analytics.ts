import type { DemoConfig } from "../types";

export const analyticsDemo: DemoConfig = {
  id: "analytics",
  prompt: "Build me a dashboard about user engagement",
  steps: [
    {
      actor: "pillar",
      label: "Searches for actions & knowledge",
      description: "Finds create_dashboard and add_chart actions.",
      detail: "search(\"create dashboard chart\") → 2 actions, 1 article",
      durationFrames: 100,
    },
    {
      actor: "app",
      label: "Calls create_dashboard",
      description: "SDK creates a new empty dashboard via your charting API.",
      detail: "create_dashboard({ title: \"User Engagement\" })\n→ { id: \"dash_92\", created: true }",
      durationFrames: 110,
    },
    {
      actor: "app",
      label: "Calls add_chart (x4)",
      description: "Pillar processes each result and calls add_chart again for DAU, session duration, retention, and signups.",
      detail: "add_chart({ dashboard: \"dash_92\", metric: \"dau\", type: \"line\" })\nadd_chart({ ... \"session_duration\" ... \"bar\" })\nadd_chart({ ... \"retention\" ... \"area\" })\nadd_chart({ ... \"signups\" ... \"number\" })",
      durationFrames: 120,
    },
    {
      actor: "done",
      label: "Dashboard live",
      description: "4 charts created. Your existing components, new layout.",
      durationFrames: 100,
    },
  ],
};
