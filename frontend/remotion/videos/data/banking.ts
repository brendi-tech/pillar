import type { DemoConfig } from "../types";

export const bankingDemo: DemoConfig = {
  id: "banking",
  prompt: "Send $200 to my cleaner",
  steps: [
    {
      actor: "pillar",
      label: "Understands the request",
      description: "Identifies: payment action, amount $200, recipient \"my cleaner\"",
      detail: "Plans: searchPayees → setAmount → preview → submit",
      durationFrames: 105,
    },
    {
      actor: "app",
      label: "Finds the right payee",
      description: "Pillar SDK calls your app's payee search in the browser.",
      detail: "searchPayees(\"cleaner\") → Maria (Cleaner)",
      durationFrames: 110,
    },
    {
      actor: "app",
      label: "Fills and previews the payment",
      description: "Navigates to /payments, fills the form, shows a preview.",
      detail: "fillPayment({ to: \"Maria\", amount: 200, date: \"today\" })",
      durationFrames: 110,
    },
    {
      actor: "done",
      label: "Payment sent",
      description: "$200 sent to Maria. No code changes to your app.",
      durationFrames: 105,
    },
  ],
};
