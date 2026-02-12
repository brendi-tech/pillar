/**
 * Tooltip descriptions explaining why each Agent Score check matters.
 * Keyed by check_name. Each entry has a short description and an optional link.
 */

interface CheckTooltip {
  description: string;
  link?: string;
  linkLabel?: string;
}

export const CHECK_TOOLTIPS: Record<string, CheckTooltip> = {
  // ── Content: Discovery ───────────────────────────────────────────────

  llms_txt_present: {
    description:
      "llms.txt gives AI agents a structured summary of your site — what it does, what APIs exist, and where to find key content. Without it, agents must reverse-engineer your site from raw HTML.",
    link: "https://llmstxt.org",
    linkLabel: "llmstxt.org spec",
  },

  structured_data: {
    description:
      "JSON-LD structured data tells agents exactly what entities exist on your page (products, organizations, articles) and their properties. This eliminates guesswork when agents extract information.",
    link: "https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data",
    linkLabel: "Google structured data guide",
  },

  sitemap_present: {
    description:
      "A sitemap lets AI crawlers discover all your pages without having to follow every link. This is critical for agents that need to index or search your full site.",
    link: "https://www.sitemaps.org/protocol.html",
    linkLabel: "Sitemap protocol",
  },

  meta_description: {
    description:
      "Meta descriptions and OpenGraph tags let agents summarize your page without reading the full HTML. Agents use these to decide whether a page is relevant before committing tokens to parse it.",
  },

  semantic_headings: {
    description:
      "Agents fold and navigate content by heading level. A clear h1 → h2 → h3 hierarchy lets them skip to relevant sections instead of reading the entire page sequentially.",
  },

  canonical_url: {
    description:
      "A canonical URL tells agents which version of a page is authoritative. Without it, agents may waste tokens on duplicate content or cite the wrong URL.",
  },

  // ── Content: Readability ─────────────────────────────────────────────

  markdown_content_negotiation: {
    description:
      "When a server responds to Accept: text/markdown with clean markdown, agents get your content at ~80% fewer tokens than raw HTML. This is the single biggest efficiency win for AI consumption.",
    link: "https://blog.cloudflare.com/markdown-for-ai-agents/",
    linkLabel: "Cloudflare Markdown for Agents",
  },

  token_efficiency: {
    description:
      "This measures how much of your HTML is actual content vs. framework noise (CSS classes, nested divs, scripts). Low ratios mean agents burn most of their context window on markup instead of your content.",
  },

  markdown_available: {
    description:
      "An /llms.txt file provides a pre-built markdown index of your site. Even if you support content negotiation, /llms.txt gives agents a discovery starting point without parsing any HTML.",
    link: "https://llmstxt.org",
    linkLabel: "llmstxt.org spec",
  },

  content_extraction: {
    description:
      "Agents try to extract your main content by looking for <main> or <article> elements. Without these, they pull in navigation, footers, and sidebars — adding noise and wasting tokens.",
  },

  semantic_html: {
    description:
      "Semantic elements like <main>, <nav>, <article>, and <section> give agents a structural map of your page. Generic <div> containers provide no hints about what content they hold.",
  },

  low_token_bloat: {
    description:
      "Every page an agent reads consumes context window tokens. Lighter pages leave more room for conversation history and multi-step workflows. Pages over 30k tokens can exhaust smaller model context windows entirely.",
  },

  // ── Content: Permissions ─────────────────────────────────────────────

  robots_txt_ai: {
    description:
      "robots.txt controls which crawlers can access your site. Blocking AI crawlers (GPTBot, ClaudeBot, etc.) prevents your content from appearing in AI answers and agent workflows.",
  },

  content_signal_header: {
    description:
      "The Content-Signal header explicitly declares whether your content can be used for AI training, search, and input. Without it, agents must guess your permissions or apply conservative defaults.",
    link: "https://contentsignals.org",
    linkLabel: "Content Signals spec",
  },

  // ── Interaction: Interactability ─────────────────────────────────────

  labeled_forms: {
    description:
      "Form inputs without labels are invisible to AI agents. Agents rely on label text and aria-label to understand what data each field expects and fill forms correctly.",
  },

  semantic_actions: {
    description:
      "Buttons labeled 'Click here' or 'Learn more' don't tell an agent what the action does. Descriptive text like 'Download pricing guide' lets agents choose the right action confidently.",
  },

  api_documentation: {
    description:
      "Exposed API docs (OpenAPI, Swagger, GraphQL) let agents interact with your service programmatically instead of navigating a UI. This is the most reliable path for agent automation.",
  },

  // ── Interaction: Accessibility ───────────────────────────────────────

  aria_labels: {
    description:
      "AI agents read pages through the accessibility tree, just like screen readers. Elements without accessible names (aria-label, label text) are invisible or ambiguous to agents.",
  },

  landmark_roles: {
    description:
      "Landmark roles (<main>, <nav>, <header>, <footer>) let agents jump directly to relevant page sections. Without landmarks, an agent must scan every element sequentially.",
  },

  keyboard_focusable: {
    description:
      "Agents interact with pages through keyboard-like actions (tab, enter, arrow keys). Interactive elements that aren't keyboard-reachable are effectively unusable by agents.",
  },

  consistent_nav: {
    description:
      "A named <nav> element with a clear aria-label helps agents parse your site's navigation structure. This lets them discover pages and understand your site's information architecture.",
  },

  // ── WebMCP ───────────────────────────────────────────────────────────

  webmcp_meta_tag: {
    description:
      "A WebMCP meta tag tells visiting agents that your page exposes tools they can call. Without this signal, agents won't know to look for WebMCP capabilities.",
    link: "https://pillar.security/tools/agent-score",
    linkLabel: "WebMCP overview",
  },

  webmcp_script_detected: {
    description:
      "References to navigator.modelContext in your scripts indicate your page implements the WebMCP API. This is the runtime interface agents use to discover and call your tools.",
  },

  tools_registered: {
    description:
      "Registered WebMCP tools are functions your page exposes for agents to call directly — like 'add to cart', 'search', or 'filter results'. No tools means agents can only read, not act.",
  },

  tool_descriptions_quality: {
    description:
      "Agents choose which tools to call based on descriptions and input schemas. Missing or vague descriptions lead agents to call the wrong tool or pass bad parameters.",
  },

  tool_count: {
    description:
      "More tools give agents more ways to interact with your page. Sites with 5+ well-described tools can support complex multi-step agent workflows.",
  },

  context_provided: {
    description:
      "provideContext() shares your page's current state (selected filters, user info, cart contents) with agents. Without it, agents must infer state from the DOM, which is error-prone.",
  },

  // ── Signup Test ──────────────────────────────────────────────────────

  signup_page_discoverable: {
    description:
      "If an AI agent can't find your signup page from the homepage, it can't onboard users on your behalf. Clear 'Sign up' links in navigation or hero sections are essential.",
  },

  signup_form_parseable: {
    description:
      "Standard HTML form elements (<form>, <input>, <label>) are what agents know how to interact with. Custom JavaScript widgets or non-standard inputs can block agent form parsing.",
  },

  signup_fields_labeled: {
    description:
      "Agents identify form fields by their labels and autocomplete attributes. Fields without labels force agents to guess — often incorrectly — what data to enter.",
  },

  signup_no_captcha: {
    description:
      "AI agents cannot solve CAPTCHAs. If your signup form requires one, agents are completely blocked. Consider risk-based challenges that only trigger for suspicious behavior.",
  },

  signup_submission_succeeds: {
    description:
      "This tests whether an AI agent can complete your signup flow end-to-end. Failures here mean agents cannot create accounts, which blocks any downstream automation.",
  },

  signup_clear_outcome: {
    description:
      "After submitting a form, agents need a clear signal of what happened — a success message, redirect, or specific error. Ambiguous outcomes leave agents unable to determine their next step.",
  },
};
