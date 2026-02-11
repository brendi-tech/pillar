import type { DemoConfig } from "../types";

export const crmDemo: DemoConfig = {
  id: "crm",
  prompt: "Close the Walmart deal as won in Salesforce and notify implementation",
  steps: [
    {
      actor: "pillar",
      label: "Searches for actions & knowledge",
      description: "Finds update_opportunity and send_notification actions.",
      detail: "search(\"close deal salesforce notify\") → 2 actions found",
      durationFrames: 100,
    },
    {
      actor: "app",
      label: "Calls update_opportunity",
      description: "SDK updates the deal stage in Salesforce via your handler.",
      detail: "update_opportunity({ name: \"Walmart\", stage: \"Closed Won\" })\n→ { id: \"opp_47x\", updated: true }",
      durationFrames: 115,
    },
    {
      actor: "app",
      label: "Calls send_notification",
      description: "Pillar processes the result, then calls the next action.",
      detail: "send_notification({ team: \"implementation\", deal: \"Walmart Q4\" })\n→ { sent: true }",
      durationFrames: 115,
    },
    {
      actor: "done",
      label: "Deal closed, team notified",
      description: "Two actions executed in sequence. Your Salesforce flow, unchanged.",
      durationFrames: 100,
    },
  ],
};
