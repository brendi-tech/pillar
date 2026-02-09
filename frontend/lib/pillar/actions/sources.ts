/**
 * Knowledge Source Management Actions for the Pillar Admin app.
 *
 * These actions help users connect and manage knowledge sources like
 * documentation sites, help centers, and knowledge bases.
 *
 * Handlers are registered separately in PillarSDKProvider via pillar.onTask()
 */
import type { SyncActionDefinitions } from "@pillar-ai/sdk";

/**
 * Data type for add_new_source action.
 * Extends base NavigateActionData with source-specific fields.
 * AI extracts these fields from user queries.
 */
export interface AddSourceData {
  highlight_selector?: string;
  type?: string;
  url?: string;
  name?: string;
}

export const sourcesActions = {
  // === Add New Source ===
  // Uses custom defaultData because it has fields beyond base NavigateActionData
  add_new_source: {
    description:
      "Navigate to add a new knowledge source. Opens a wizard to connect " +
      "external documentation, help centers, knowledge bases, websites, or cloud storage buckets. " +
      "Use when user wants to import content, connect a source, add an integration, " +
      "or sync from an external platform. " +
      "Extract the source type and URL if mentioned in the user's message.",
    examples: [
      "can you help me setup my help center import",
      "how do I import my help center",
      "connect a knowledge source",
      "add a new source",
      "import documentation",
      "setup help center import",
      "connect my help center",
      "add knowledge base",
      "import content from website",
      "connect external documentation",
      "test async sync workflow",
    ],
    type: "navigate" as const,
    path: "/knowledge/new",
    autoRun: true,
    autoComplete: true,
    dataSchema: {
      type: "object" as const,
      properties: {
        type: {
          type: "string" as const,
          description:
            "Source type ID if user mentions a specific type. Values: " +
            "'website' for crawling any website (help centers, docs sites, marketing sites), " +
            "'bucket' for cloud storage buckets (S3/GCS)",
        },
        url: {
          type: "string" as const,
          description: "URL of the source to connect (for website crawl)",
        },
        name: {
          type: "string" as const,
          description: "Display name for the source if mentioned",
        },
      },
    },
    // Custom defaultData for type inference (extends NavigateActionData)
    defaultData: {} as AddSourceData,
  },

  // === Website Crawl ===
  // No defaultData needed - uses base NavigateActionData from type: "navigate"
  crawl_website: {
    description:
      "Crawl a website by URL to import content. Works for help centers, " +
      "documentation sites, marketing sites, and any public website. " +
      "Use when user wants to import content from a website, help center, docs site, " +
      "or marketing site. Examples: Zendesk Guide sites, Intercom help centers, " +
      "GitBook sites, custom documentation sites, company marketing pages.",
    type: "navigate" as const,
    path: "/knowledge/new?type=website",
    autoRun: true,
    autoComplete: true,
  },

  connect_cloud_storage: {
    description:
      "Connect a cloud storage bucket (AWS S3 or Google Cloud Storage) to sync documents. " +
      "Use when user wants to connect S3, GCS, cloud storage, or sync files from buckets.",
    type: "navigate" as const,
    path: "/knowledge/new?type=bucket",
    autoRun: true,
    autoComplete: true,
  },

  // === Source Management Actions ===
  // These actions perform operations on existing knowledge sources

  resync_source: {
    description:
      "Trigger a re-sync for a knowledge source to refresh content. " +
      "Use when user wants to update content, refresh docs, re-crawl a website, " +
      "or sync the latest changes from a source. " +
      "Call list_sources first if source_id is unknown.",
    examples: [
      "resync my documentation",
      "refresh the knowledge base",
      "re-crawl the website",
      "update the docs source",
      "sync the help center again",
    ],
    type: "trigger_action" as const,
    autoRun: false,
    autoComplete: false,
    dataSchema: {
      type: "object" as const,
      properties: {
        source_id: {
          type: "string" as const,
          description: "ID of the source to resync (from list_sources)",
        },
      },
      required: ["source_id"],
    },
  },

  delete_source: {
    description:
      "Delete a knowledge source and remove all its content from the knowledge base. " +
      "This is a destructive action that cannot be undone. " +
      "Use when user wants to remove a source, disconnect an integration, " +
      "or delete imported content.",
    examples: [
      "delete the old documentation source",
      "remove the website crawl",
      "disconnect the help center",
      "delete knowledge source",
    ],
    type: "trigger_action" as const,
    autoRun: false,
    autoComplete: false,
    dataSchema: {
      type: "object" as const,
      properties: {
        source_id: {
          type: "string" as const,
          description: "ID of the source to delete (from list_sources)",
        },
      },
      required: ["source_id"],
    },
  },
} as const satisfies SyncActionDefinitions;
