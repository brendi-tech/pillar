export type DemoSlug = "banking" | "crm" | "analytics" | "pm" | "hr";

export interface VideoDemoData {
  title: string;
  prompt: string;
  description: string;
  mp4: string;
  webm: string;
  thumbnail: string;
  durationISO: string;
  durationSec: number;
  uploadDate: string;
  tags: string[];
}

export const VIDEO_DEMOS: Record<DemoSlug, VideoDemoData> = {
  banking: {
    title: "Banking demo",
    prompt: "Send $200 to my cleaner",
    description: "Find payee, set amount/date, preview, and submit.",
    mp4: "/marketing/BankingDemo.mp4",
    webm: "/marketing/BankingDemo.webm",
    thumbnail: "/marketing/BankingDemo-thumb.png",
    durationISO: "PT18S",
    durationSec: 18,
    uploadDate: "2025-06-01",
    tags: ["banking", "payment", "AI assistant", "fintech", "Pillar"],
  },
  crm: {
    title: "CRM demo (Salesforce)",
    prompt:
      "Close the Walmart deal as won in Salesforce and notify implementation",
    description:
      "Find the opportunity, update stage, and kick off an implementation handoff.",
    mp4: "/marketing/CRMDemo.mp4",
    webm: "/marketing/CRMDemo.webm",
    thumbnail: "/marketing/CRMDemo-thumb.png",
    durationISO: "PT18S",
    durationSec: 18,
    uploadDate: "2025-06-01",
    tags: ["CRM", "Salesforce", "AI assistant", "sales", "Pillar"],
  },
  analytics: {
    title: "Analytics demo (Amplitude)",
    prompt: "Add a weekly signups chart to my Amplitude dashboard",
    description: "Create a chart and add it to a dashboard.",
    mp4: "/marketing/AnalyticsDemo.mp4",
    webm: "/marketing/AnalyticsDemo.webm",
    thumbnail: "/marketing/AnalyticsDemo-thumb.png",
    durationISO: "PT18S",
    durationSec: 18,
    uploadDate: "2025-06-01",
    tags: ["analytics", "Amplitude", "AI assistant", "dashboard", "Pillar"],
  },
  pm: {
    title: "Project management demo (Linear)",
    prompt:
      "Create a P1 bug in Linear for the checkout crash and add it to this sprint",
    description: "Open issue form, fill fields, and add it to the cycle.",
    mp4: "/marketing/PMDemo.mp4",
    webm: "/marketing/PMDemo.webm",
    thumbnail: "/marketing/PMDemo-thumb.png",
    durationISO: "PT18S",
    durationSec: 18,
    uploadDate: "2025-06-01",
    tags: [
      "project management",
      "Linear",
      "AI assistant",
      "bug tracking",
      "Pillar",
    ],
  },
  hr: {
    title: "HR/People demo (Rippling)",
    prompt: "How do I change my direct deposit in Rippling?",
    description: "Navigate to payroll settings and open the edit flow.",
    mp4: "/marketing/HRDemo.mp4",
    webm: "/marketing/HRDemo.webm",
    thumbnail: "/marketing/HRDemo-thumb.png",
    durationISO: "PT17S",
    durationSec: 17,
    uploadDate: "2025-06-01",
    tags: ["HR", "Rippling", "AI assistant", "payroll", "Pillar"],
  },
};
