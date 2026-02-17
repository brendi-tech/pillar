import type { DemoConfig } from "../types";

export const bankingDemo: DemoConfig = {
  id: "banking",
  prompt: "Send $200 to my cleaner",
  steps: [
    {
      actor: "pillar",
      label: "Searches for actions & knowledge",
      description: "Finds send_payment action and payment help articles.",
      detail: "search(\"send payment\") → action: send_payment, 2 articles",
      durationFrames: 315,
    },
    {
      actor: "app",
      label: "Calls send_payment in your app",
      description: "SDK executes the action handler in the user's browser.",
      detail: "send_payment({ amount: 200, recipient: \"cleaner\" })\n→ { to: \"Maria\", amount: 200, status: \"preview\" }",
      durationFrames: 115,
    },
    {
      actor: "pillar",
      label: "Processes result, confirms",
      description: "Receives the action result. Streams a confirmation to the user.",
      detail: "\"I've set up a $200 payment to Maria. Ready to send.\"",
      durationFrames: 330,
    },
    {
      actor: "done",
      label: "Payment ready",
      description: "Form filled, preview shown. No changes to your payment flow.",
      durationFrames: 100,
    },
  ],
};
