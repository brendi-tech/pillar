import type { DemoConfig } from "../types";

export const crmDemo: DemoConfig = {
  id: "crm",
  prompt: "Close the Walmart deal as won in Salesforce and notify implementation",
  steps: [
    {
      actor: "pillar",
      label: "Plans the sequence",
      description: "Identifies: update opportunity, set stage, notify team, open handoff.",
      detail: "findOpportunity → updateStage → notifyTeam → openHandoff",
      durationFrames: 105,
    },
    {
      actor: "app",
      label: "Finds and updates the deal",
      description: "SDK searches Salesforce opportunities, then updates the stage field.",
      detail: "searchOpps(\"Walmart\") → Walmart Q4\nupdateStage(\"opp_47x\", \"Closed Won\")",
      durationFrames: 115,
    },
    {
      actor: "app",
      label: "Notifies implementation team",
      description: "Triggers a notification and pre-fills the handoff form with deal context.",
      detail: "notify(\"implementation\", { deal: \"Walmart Q4\" })\nopenForm(\"handoff\", prefilled)",
      durationFrames: 115,
    },
    {
      actor: "done",
      label: "Deal closed, team notified",
      description: "Stage updated, implementation team alerted, handoff form ready.",
      durationFrames: 105,
    },
  ],
};
