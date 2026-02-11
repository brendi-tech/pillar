import type { DemoConfig } from "../types";

export const pmDemo: DemoConfig = {
  id: "pm",
  prompt: "Create a P1 bug in Linear for the checkout crash and add it to this sprint",
  steps: [
    {
      actor: "pillar",
      label: "Searches for actions & knowledge",
      description: "Finds create_issue and add_to_sprint actions.",
      detail: "search(\"create issue linear sprint\") → 2 actions found",
      durationFrames: 100,
    },
    {
      actor: "app",
      label: "Calls create_issue",
      description: "SDK creates the bug in Linear via your handler.",
      detail: "create_issue({ type: \"bug\", priority: 1, title: \"Checkout crash\" })\n→ { id: \"FE-342\", created: true }",
      durationFrames: 115,
    },
    {
      actor: "app",
      label: "Calls add_to_sprint",
      description: "Pillar processes the result, then assigns to current sprint.",
      detail: "add_to_sprint({ issue: \"FE-342\", sprint: \"Sprint 24\" })\n→ { assigned: true }",
      durationFrames: 115,
    },
    {
      actor: "done",
      label: "Bug filed and scheduled",
      description: "Issue created, added to sprint. Your Linear workflow, unchanged.",
      durationFrames: 100,
    },
  ],
};
