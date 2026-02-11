import type { DemoConfig } from "../types";

export const analyticsDemo: DemoConfig = {
  id: "analytics",
  prompt: "Build me a dashboard about user engagement",
  steps: [
    {
      actor: "pillar",
      label: "Designs the dashboard",
      description: "Picks metrics: DAU, session duration, retention, signups. Plans layout.",
      detail: "createDashboard → addChart (×4) → configureLayout",
      durationFrames: 105,
    },
    {
      actor: "app",
      label: "Creates charts via your API",
      description: "SDK calls your app's charting API to create each widget.",
      detail: "createChart({ event: \"active_users\", type: \"line\" })\ncreateChart({ event: \"session_duration\", type: \"bar\" })",
      durationFrames: 115,
    },
    {
      actor: "app",
      label: "Assembles the dashboard",
      description: "Adds all 4 charts to a new dashboard, configures grid positions.",
      detail: "createChart({ event: \"retention\", type: \"area\" })\naddToDashboard(dashId, [chart1, chart2, chart3, chart4])",
      durationFrames: 115,
    },
    {
      actor: "done",
      label: "Dashboard live",
      description: "4-chart engagement dashboard created. Your existing components, new layout.",
      durationFrames: 105,
    },
  ],
};
