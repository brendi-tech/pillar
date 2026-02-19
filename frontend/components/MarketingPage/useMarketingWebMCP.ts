"use client";

/**
 * useMarketingWebMCP
 *
 * Registers WebMCP tools on the marketing homepage so browser agents
 * (e.g. AI assistants using the W3C navigator.modelContext API) can
 * discover and invoke page navigations programmatically.
 *
 * Only registers if `navigator.modelContext` is available — either natively
 * or via a polyfill loaded by the agent's environment. We don't ship the
 * polyfill ourselves; this is pure feature detection.
 *
 * Tools are registered on mount and unregistered on unmount.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Minimal type for the subset of the WebMCP API we use. */
interface WebMCPToolDefinition {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  execute: (params: Record<string, unknown>) => Promise<{
    content: { type: string; text: string }[];
  }>;
}

interface ModelContext {
  registerTool: (tool: WebMCPToolDefinition) => void;
  unregisterTool: (name: string) => void;
}

declare global {
  interface Navigator {
    modelContext?: ModelContext;
  }
}

/** All tools we register on the marketing page. */
function getMarketingTools(
  navigate: (path: string) => void
): WebMCPToolDefinition[] {
  return [
    {
      name: "navigate-to-pricing",
      description:
        "Navigate to the Pillar pricing page to view available plans, features, and costs. " +
        "Use when someone wants to learn about pricing, compare plans, or check costs.",
      execute: async () => {
        navigate("/pricing");
        return {
          content: [{ type: "text", text: "Navigated to the pricing page." }],
        };
      },
    },
    {
      name: "navigate-to-docs",
      description:
        "Navigate to the Pillar documentation. Covers SDK installation, React/Vue/Angular " +
        "integrations, configuration guides, and API reference.",
      execute: async () => {
        navigate("/docs");
        return {
          content: [
            { type: "text", text: "Navigated to the documentation." },
          ],
        };
      },
    },
    {
      name: "navigate-to-blog",
      description:
        "Navigate to the Pillar blog for product updates, engineering posts, and guides.",
      execute: async () => {
        navigate("/blog");
        return {
          content: [{ type: "text", text: "Navigated to the blog." }],
        };
      },
    },
    {
      name: "sign-up",
      description:
        "Navigate to the sign-up page to create a new Pillar account. " +
        "Includes a free tier. Use when someone wants to get started or create an account.",
      execute: async () => {
        navigate("/signup");
        return {
          content: [
            { type: "text", text: "Navigated to the sign-up page." },
          ],
        };
      },
    },
    {
      name: "log-in",
      description:
        "Navigate to the login page for existing Pillar users.",
      execute: async () => {
        navigate("/login");
        return {
          content: [{ type: "text", text: "Navigated to the login page." }],
        };
      },
    },
    {
      name: "check-agent-readiness",
      description:
        "Navigate to the Agent Readiness Score tool. Analyzes any website to determine " +
        "how well it supports AI agents — checks for WebMCP tools, structured data, " +
        "accessibility, and more. Use when someone wants to test if their site is ready " +
        "for AI agents.",
      execute: async () => {
        navigate("/resources/agent-score");
        return {
          content: [
            {
              type: "text",
              text: "Navigated to the Agent Readiness Score tool.",
            },
          ],
        };
      },
    },
    {
      name: "view-demo",
      description:
        "Navigate to a Pillar product demo. Available demos: 'grafana' (AI copilot " +
        "embedded in Grafana dashboards) and 'superset' (AI copilot embedded in " +
        "Apache Superset). Example: view-demo({ demo: 'grafana' })",
      inputSchema: {
        type: "object",
        properties: {
          demo: {
            type: "string",
            enum: ["grafana", "superset"],
            description:
              "Which demo to view: 'grafana' or 'superset'.",
          },
        },
        required: ["demo"],
      },
      execute: async (params) => {
        const demo = params.demo as string;
        const validDemos = ["grafana", "superset"];
        if (!validDemos.includes(demo)) {
          return {
            content: [
              {
                type: "text",
                text: `Invalid demo "${demo}". Available demos: ${validDemos.join(", ")}`,
              },
            ],
          };
        }
        navigate(`/demos/${demo}`);
        return {
          content: [
            { type: "text", text: `Navigated to the ${demo} demo.` },
          ],
        };
      },
    },
    {
      name: "view-github",
      description:
        "Open the Pillar GitHub repository. Pillar is open source.",
      execute: async () => {
        window.open("https://github.com/pillarhq/pillar", "_blank");
        return {
          content: [
            { type: "text", text: "Opened the Pillar GitHub repository." },
          ],
        };
      },
    },
    {
      name: "contact-sales",
      description:
        "Contact the Pillar sales team for enterprise pricing or custom plans. " +
        "Opens an email to team@trypillar.com.",
      execute: async () => {
        window.open("mailto:team@trypillar.com", "_blank");
        return {
          content: [
            {
              type: "text",
              text: "Opened email to team@trypillar.com for enterprise inquiries.",
            },
          ],
        };
      },
    },
  ];
}

/**
 * Registers WebMCP tools for the marketing homepage.
 * No-ops if navigator.modelContext is unavailable.
 */
export function useMarketingWebMCP() {
  const router = useRouter();

  useEffect(() => {
    if (!("modelContext" in navigator) || !navigator.modelContext) {
      return;
    }

    const mc = navigator.modelContext;
    const navigate = (path: string) => router.push(path);
    const tools = getMarketingTools(navigate);

    // Register all tools
    for (const tool of tools) {
      mc.registerTool(tool);
    }

    // Unregister on unmount
    return () => {
      for (const tool of tools) {
        mc.unregisterTool(tool.name);
      }
    };
  }, [router]);
}
