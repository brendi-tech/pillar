"""
Constants for Agent Score — category registry, check definitions, AI crawler list.

CATEGORY_REGISTRY is the single source of truth for every scoring category.
Adding a new category here is all the backend needs (besides the analyzer itself)
— the API exposes this registry to the frontend so it renders automatically.
"""

# ──────────────────────────────────────────────
# Category registry — single source of truth
# ──────────────────────────────────────────────
# weight: float  → contributes to overall score with this weight
# weight: None   → scored independently, excluded from overall score

CATEGORY_REGISTRY: dict[str, dict] = {
    "openclaw": {
        "label": "Agent Experience",
        "description": "What happened when a real AI agent tried to use your site?",
        "weight": 0.50,
        "sort_order": 1,
    },
    "signup_test": {
        "label": "Signup Test",
        "description": "Can an AI agent create an account on your site?",
        "weight": 0.25,
        "sort_order": 2,
    },
    "rules": {
        "label": "Rules",
        "description": "Does your site follow best practices for AI agent access and interaction?",
        "weight": 0.25,
        "sort_order": 3,
    },
    "webmcp": {
        "label": "WebMCP (Beta)",
        "description": "Does your site expose tools for AI agents?",
        "weight": None,  # excluded from overall score
        "sort_order": 4,
    },
}

# Derived from the registry — kept for backward compatibility with code that
# imports CATEGORY_WEIGHTS directly (scoring.py, etc.).
# When signup_test is disabled at scan time its weight is redistributed
# proportionally across the remaining categories.
CATEGORY_WEIGHTS: dict[str, float] = {
    k: v["weight"] for k, v in CATEGORY_REGISTRY.items() if v["weight"] is not None
}

# Score color thresholds (Lighthouse-style)
SCORE_RED_MAX = 49
SCORE_ORANGE_MAX = 89
# 90-100 is green

# Known AI crawler user-agent tokens
AI_CRAWLERS: list[str] = [
    "GPTBot",
    "ChatGPT-User",
    "Google-Extended",
    "ClaudeBot",
    "anthropic-ai",
    "CCBot",
    "PerplexityBot",
    "Bytespider",
    "Amazonbot",
    "YouBot",
    "Applebot-Extended",
    "cohere-ai",
    "Meta-ExternalAgent",
    "FacebookBot",
]

# Generic / non-descriptive action text that agents can't reason about
GENERIC_ACTION_TEXT: set[str] = {
    "",
    "click here",
    "click",
    "here",
    "learn more",
    "read more",
    "more",
    "submit",
    "go",
    "ok",
    "button",
    "link",
}

# axe-core rules relevant to AI agent usability
AGENT_RELEVANT_AXE_RULES: set[str] = {
    # Form labeling (critical for agents)
    "label", "label-title-only", "input-image-alt",
    # Button/link accessibility (critical for agents)
    "button-name", "link-name", "image-alt",
    # ARIA correctness (critical — wrong ARIA is worse than none)
    "aria-allowed-attr", "aria-hidden-body", "aria-required-attr",
    "aria-required-children", "aria-required-parent", "aria-roles",
    "aria-valid-attr", "aria-valid-attr-value",
    # Landmark/structure (important for agent navigation)
    "landmark-one-main", "landmark-unique", "region",
    "heading-order", "page-has-heading-one",
    # Keyboard (important for agent interaction)
    "tabindex", "focus-order-semantics",
}

# ──────────────────────────────────────────────
# Check registry: every check with its metadata
# ──────────────────────────────────────────────

CHECK_DEFINITIONS: list[dict] = [
    # === Rules (25%) — discovery + readability + permissions + interactability + accessibility ===
    {
        "category": "rules",
        "check_name": "markdown_content_negotiation",
        "check_label": "Markdown content negotiation",
        "weight": 12,
    },
    {
        "category": "rules",
        "check_name": "token_efficiency",
        "check_label": "Token efficiency",
        "weight": 10,
    },
    {
        "category": "rules",
        "check_name": "robots_txt_ai",
        "check_label": "AI crawlers in robots.txt",
        "weight": 10,
    },
    {
        "category": "rules",
        "check_name": "structured_data",
        "check_label": "Structured data (JSON-LD)",
        "weight": 9,
    },
    {
        "category": "rules",
        "check_name": "llms_txt_present",
        "check_label": "Has /llms.txt",
        "weight": 8,
    },
    {
        "category": "rules",
        "check_name": "content_signal_header",
        "check_label": "Content-Signal header",
        "weight": 8,
    },
    {
        "category": "rules",
        "check_name": "semantic_html",
        "check_label": "Semantic HTML elements",
        "weight": 7,
    },
    {
        "category": "rules",
        "check_name": "content_extraction",
        "check_label": "Content extraction quality",
        "weight": 7,
    },
    {
        "category": "rules",
        "check_name": "semantic_headings",
        "check_label": "Heading hierarchy (h1–h6)",
        "weight": 6,
    },
    {
        "category": "rules",
        "check_name": "meta_description",
        "check_label": "Meta & OpenGraph tags",
        "weight": 5,
    },
    {
        "category": "rules",
        "check_name": "low_token_bloat",
        "check_label": "Token footprint",
        "weight": 5,
    },
    {
        "category": "rules",
        "check_name": "markdown_available",
        "check_label": "Markdown version (/llms.txt)",
        "weight": 5,
    },
    {
        "category": "rules",
        "check_name": "sitemap_present",
        "check_label": "Has /sitemap.xml",
        "weight": 5,
    },
    {
        "category": "rules",
        "check_name": "labeled_forms",
        "check_label": "All form inputs labeled",
        "weight": 20,
    },
    {
        "category": "rules",
        "check_name": "aria_labels",
        "check_label": "Interactive elements have ARIA labels",
        "weight": 20,
    },
    {
        "category": "rules",
        "check_name": "semantic_actions",
        "check_label": "Buttons and links have descriptive text",
        "weight": 15,
    },
    {
        "category": "rules",
        "check_name": "landmark_roles",
        "check_label": "Page uses landmark roles",
        "weight": 15,
    },
    {
        "category": "rules",
        "check_name": "keyboard_focusable",
        "check_label": "Interactive elements are keyboard-reachable",
        "weight": 15,
    },
    {
        "category": "rules",
        "check_name": "consistent_nav",
        "check_label": "Navigation structure is consistent",
        "weight": 10,
    },
    {
        "category": "rules",
        "check_name": "api_documentation",
        "check_label": "MCP or API documentation exposed",
        "weight": 5,
    },
    # === WebMCP (15%) ===
    {
        "category": "webmcp",
        "check_name": "webmcp_meta_tag",
        "check_label": "Page declares WebMCP support",
        "weight": 15,
    },
    {
        "category": "webmcp",
        "check_name": "webmcp_script_detected",
        "check_label": "WebMCP API referenced in scripts",
        "weight": 20,
    },
    {
        "category": "webmcp",
        "check_name": "tools_registered",
        "check_label": "WebMCP tools registered",
        "weight": 25,
    },
    {
        "category": "webmcp",
        "check_name": "tool_descriptions_quality",
        "check_label": "Tool descriptions and schemas quality",
        "weight": 20,
    },
    {
        "category": "webmcp",
        "check_name": "tool_count",
        "check_label": "Number of WebMCP tools exposed",
        "weight": 10,
    },
    {
        "category": "webmcp",
        "check_name": "context_provided",
        "check_label": "Uses provideContext() for page state",
        "weight": 10,
    },
    # === Signup Test (25%) ===
    # NOTE: Signup test checks are DYNAMIC — generated at runtime from the
    # agent's self-scored result (tasks_tried + boolean flags), following the
    # same pattern as OpenClaw. The category score comes from the agent's
    # self-assessment (0-100), not from check aggregation.
    # These reference entries document the boolean-level checks that are
    # always created; additional task-level checks (signup_task_*) are
    # generated dynamically from the agent's tasks_tried array.
    {
        "category": "signup_test",
        "check_name": "signup_signup_page_found",
        "check_label": "Signup page found by agent",
        "weight": 1,
    },
    {
        "category": "signup_test",
        "check_name": "signup_form_found",
        "check_label": "Signup form detected",
        "weight": 1,
    },
    {
        "category": "signup_test",
        "check_name": "signup_captcha_detected",
        "check_label": "CAPTCHA blocked signup",
        "weight": 1,
    },
    {
        "category": "signup_test",
        "check_name": "signup_submission_succeeded",
        "check_label": "Form submission succeeded",
        "weight": 1,
    },
]
