import type { DemoConfig } from "../types";

export const hrDemo: DemoConfig = {
  id: "hr",
  prompt: "How do I change my direct deposit in Rippling?",
  steps: [
    {
      actor: "pillar",
      label: "Searches for actions & knowledge",
      description: "Finds direct deposit help article and navigate action.",
      detail: "search(\"change direct deposit\") → 1 action, 1 article",
      durationFrames: 100,
    },
    {
      actor: "app",
      label: "Calls navigate in your app",
      description: "SDK navigates the user's browser to the payroll settings page.",
      detail: "navigate({ path: \"/settings/payroll\" })\n→ { navigated: true }",
      durationFrames: 115,
    },
    {
      actor: "app",
      label: "Calls interact_with_page",
      description: "Pillar expands the Direct Deposit section and enters edit mode.",
      detail: "interact_with_page({ expand: \"Direct Deposit\", click: \"Edit\" })\n→ { fields: [\"routing_number\", \"account_number\"] }",
      durationFrames: 115,
    },
    {
      actor: "done",
      label: "Ready to update",
      description: "Form open, fields highlighted. Guided there without rebuilding your settings page.",
      durationFrames: 100,
    },
  ],
};
