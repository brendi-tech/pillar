import type { DemoConfig } from "../types";

export const hrDemo: DemoConfig = {
  id: "hr",
  prompt: "How do I change my direct deposit in Rippling?",
  steps: [
    {
      actor: "pillar",
      label: "Finds the right path",
      description: "Identifies: payroll settings, direct deposit section, edit flow.",
      detail: "navigate → expandSection → openEdit → highlightFields",
      durationFrames: 105,
    },
    {
      actor: "app",
      label: "Navigates to payroll settings",
      description: "SDK navigates your app to the payroll page and opens the right section.",
      detail: "navigate(\"/settings/payroll\")\nexpandSection(\"Direct Deposit\")",
      durationFrames: 115,
    },
    {
      actor: "app",
      label: "Opens the edit form",
      description: "Enters edit mode and highlights the fields you need to fill.",
      detail: "clickEdit(\"direct-deposit\")\nhighlight([\"routing_number\", \"account_number\"])",
      durationFrames: 115,
    },
    {
      actor: "done",
      label: "Ready to update",
      description: "Form open, fields highlighted. Pillar guided you there without rebuilding your settings page.",
      durationFrames: 105,
    },
  ],
};
