"""
Constants for Agent Score — category weights, check definitions, AI crawler list.
"""

# Category weights for the overall score (must sum to 1.0).
# WebMCP is scored separately but excluded from the overall score
# because very few sites support it today — including it would unfairly
# penalize most sites.  When signup_test is disabled, its weight is
# redistributed proportionally across the remaining categories.
CATEGORY_WEIGHTS: dict[str, float] = {
    "content": 0.40,
    "interaction": 0.40,
    "signup_test": 0.20,
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
    # === Content (35%) — discovery + readability + permissions ===
    {
        "category": "content",
        "check_name": "markdown_content_negotiation",
        "check_label": "Supports Accept: text/markdown content negotiation",
        "weight": 12,
    },
    {
        "category": "content",
        "check_name": "token_efficiency",
        "check_label": "Token efficiency (content vs HTML ratio)",
        "weight": 10,
    },
    {
        "category": "content",
        "check_name": "robots_txt_ai",
        "check_label": "AI crawlers allowed in robots.txt",
        "weight": 10,
    },
    {
        "category": "content",
        "check_name": "structured_data",
        "check_label": "JSON-LD / Schema.org structured data",
        "weight": 9,
    },
    {
        "category": "content",
        "check_name": "llms_txt_present",
        "check_label": "Has /llms.txt",
        "weight": 8,
    },
    {
        "category": "content",
        "check_name": "content_signal_header",
        "check_label": "Content-Signal header declares AI usage permissions",
        "weight": 8,
    },
    {
        "category": "content",
        "check_name": "semantic_html",
        "check_label": "Semantic HTML elements used",
        "weight": 7,
    },
    {
        "category": "content",
        "check_name": "content_extraction",
        "check_label": "Clean content extraction quality",
        "weight": 7,
    },
    {
        "category": "content",
        "check_name": "semantic_headings",
        "check_label": "Proper heading hierarchy (h1–h6)",
        "weight": 6,
    },
    {
        "category": "content",
        "check_name": "meta_description",
        "check_label": "Meta description and OpenGraph tags",
        "weight": 5,
    },
    {
        "category": "content",
        "check_name": "low_token_bloat",
        "check_label": "Page token footprint",
        "weight": 5,
    },
    {
        "category": "content",
        "check_name": "markdown_available",
        "check_label": "Markdown version available (/llms.txt)",
        "weight": 5,
    },
    {
        "category": "content",
        "check_name": "sitemap_present",
        "check_label": "Has /sitemap.xml",
        "weight": 5,
    },
    {
        "category": "content",
        "check_name": "canonical_url",
        "check_label": "Has canonical URL",
        "weight": 3,
    },
    # === Interaction (35%) — interactability + accessibility ===
    {
        "category": "interaction",
        "check_name": "labeled_forms",
        "check_label": "All form inputs labeled",
        "weight": 20,
    },
    {
        "category": "interaction",
        "check_name": "aria_labels",
        "check_label": "Interactive elements have ARIA labels",
        "weight": 20,
    },
    {
        "category": "interaction",
        "check_name": "semantic_actions",
        "check_label": "Buttons and links have descriptive text",
        "weight": 15,
    },
    {
        "category": "interaction",
        "check_name": "landmark_roles",
        "check_label": "Page uses landmark roles",
        "weight": 15,
    },
    {
        "category": "interaction",
        "check_name": "keyboard_focusable",
        "check_label": "Interactive elements are keyboard-reachable",
        "weight": 15,
    },
    {
        "category": "interaction",
        "check_name": "consistent_nav",
        "check_label": "Navigation structure is consistent",
        "weight": 10,
    },
    {
        "category": "interaction",
        "check_name": "api_documentation",
        "check_label": "API documentation available",
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
    # === Signup Test (15%) ===
    {
        "category": "signup_test",
        "check_name": "signup_page_discoverable",
        "check_label": "Signup page discoverable by agent",
        "weight": 15,
    },
    {
        "category": "signup_test",
        "check_name": "signup_form_parseable",
        "check_label": "Signup form parseable by agent",
        "weight": 20,
    },
    {
        "category": "signup_test",
        "check_name": "signup_fields_labeled",
        "check_label": "Signup form fields identifiable",
        "weight": 15,
    },
    {
        "category": "signup_test",
        "check_name": "signup_no_captcha",
        "check_label": "Signup form free of CAPTCHA",
        "weight": 20,
    },
    {
        "category": "signup_test",
        "check_name": "signup_submission_succeeds",
        "check_label": "Signup form submission succeeds",
        "weight": 20,
    },
    {
        "category": "signup_test",
        "check_name": "signup_clear_outcome",
        "check_label": "Clear outcome after signup attempt",
        "weight": 10,
    },
]
