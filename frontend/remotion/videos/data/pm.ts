import type { DemoConfig } from "../types";

export const pmDemo: DemoConfig = {
  id: "pm",
  prompt: "Create a P1 bug in Linear for the checkout crash and add it to this sprint",
  steps: [
    {
      actor: "pillar",
      label: "Plans the issue creation",
      description: "Identifies: bug type, P1 priority, title, assign to current sprint.",
      detail: "getTeam → createIssue → addToSprint",
      durationFrames: 105,
    },
    {
      actor: "app",
      label: "Creates the issue",
      description: "SDK calls Linear's issue API with the right fields pre-filled.",
      detail: "createIssue({ type: \"bug\", priority: 1,\n  title: \"Checkout crash\", team: \"Frontend\" })",
      durationFrames: 115,
    },
    {
      actor: "app",
      label: "Adds to current sprint",
      description: "Assigns FE-342 to Sprint 24 and opens the issue view.",
      detail: "addToSprint(\"FE-342\", \"Sprint 24\")\nnavigate(\"/issues/FE-342\")",
      durationFrames: 115,
    },
    {
      actor: "done",
      label: "Bug filed and scheduled",
      description: "P1 bug created in Linear, added to sprint. Your workflow, unchanged.",
      durationFrames: 105,
    },
  ],
};
