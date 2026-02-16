"use client";

import { useState, useCallback } from "react";
import { ExternalLink, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Data — curated from CheckRow.tooltips.ts, organized for SEO-friendly prose
// ---------------------------------------------------------------------------

interface GuideCheck {
  title: string;
  description: string;
  link?: string;
  linkLabel?: string;
}

interface GuideCategory {
  heading: string;
  slug: string;
  intro: string;
  subcategories: {
    heading: string;
    checks: GuideCheck[];
  }[];
}

const GUIDE_CATEGORIES: GuideCategory[] = [
  {
    heading: "Openclaw Experience",
    slug: "openclaw",
    intro:
      "What happens when a real AI agent tries to use your site? We release an autonomous agent — powered by OpenClaw — to browse, navigate, sign up, and complete tasks on your site, then report what worked and what didn't.",
    subcategories: [
      {
        heading: "End-to-End Agent Test",
        checks: [
          {
            title: "Navigation & Exploration",
            description:
              "The agent explores your site freely — clicking links, reading pages, and building a mental model of your information architecture. Sites with clear navigation and semantic structure score higher.",
          },
          {
            title: "Task Completion",
            description:
              "The agent attempts real tasks: signing up, searching, filtering, or completing flows. Each successful task demonstrates that your site works for AI-driven automation.",
          },
          {
            title: "Error Handling & Feedback",
            description:
              "When the agent hits errors or dead ends, how your site responds matters. Clear error messages and recovery paths help agents self-correct — vague failures leave them stuck.",
          },
          {
            title: "Overall Agent Experience Score",
            description:
              "After exploring your site, the agent self-scores its overall experience. This reflects a holistic assessment of how well your site works for AI agents, not just individual checks.",
            link: "https://openclaw.ai",
            linkLabel: "OpenClaw",
          },
        ],
      },
    ],
  },
  {
    heading: "Browserbase Test",
    slug: "signup",
    intro:
      "Can an AI agent create an account on your site? We run a real browser-based agent through your signup flow — finding the form, filling fields, and clicking submit.",
    subcategories: [
      {
        heading: "Signup Flow",
        checks: [
          {
            title: "Signup Page Discoverable",
            description:
              "If an AI agent can't find your signup page from the homepage, it can't onboard users on your behalf. Clear \"Sign up\" links in navigation or hero sections are essential.",
          },
          {
            title: "Signup Form Parseable",
            description:
              "Standard HTML form elements — <form>, <input>, <label> — are what agents know how to interact with. Custom JavaScript widgets or non-standard inputs can block agent form parsing.",
          },
          {
            title: "Fields Identifiable",
            description:
              "Agents identify form fields by their labels and autocomplete attributes. Fields without labels force agents to guess — often incorrectly — what data to enter.",
          },
          {
            title: "No CAPTCHA Blocking",
            description:
              "AI agents cannot solve CAPTCHAs. If your signup form requires one, agents are completely blocked. Consider risk-based challenges that only trigger for suspicious behavior.",
          },
          {
            title: "Submission Succeeds",
            description:
              "This tests whether an AI agent can complete your signup flow end-to-end. Failures here mean agents cannot create accounts, which blocks any downstream automation.",
          },
          {
            title: "Clear Outcome Signal",
            description:
              "After submitting a form, agents need a clear signal of what happened — a success message, redirect, or specific error. Ambiguous outcomes leave agents unable to determine their next step.",
          },
        ],
      },
    ],
  },
  {
    heading: "Rules",
    slug: "rules",
    intro:
      "Does your site follow best practices for AI agent access and interaction? These checks cover content discovery, readability, permissions, form labeling, and accessibility — everything an agent needs to read and act on your site.",
    subcategories: [
      {
        heading: "Discovery",
        checks: [
          {
            title: "llms.txt",
            description:
              "llms.txt gives AI agents a structured summary of your site — what it does, what APIs exist, and where to find key content. Without it, agents must reverse-engineer your site from raw HTML.",
            link: "https://llmstxt.org",
            linkLabel: "llmstxt.org spec",
          },
          {
            title: "Structured Data (JSON-LD)",
            description:
              "JSON-LD structured data tells agents exactly what entities exist on your page — products, organizations, articles — and their properties. This eliminates guesswork when agents extract information.",
            link: "https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data",
            linkLabel: "Google structured data guide",
          },
          {
            title: "Sitemap",
            description:
              "A sitemap lets AI crawlers discover all your pages without following every link. This is critical for agents that need to index or search your full site.",
            link: "https://www.sitemaps.org/protocol.html",
            linkLabel: "Sitemap protocol",
          },
          {
            title: "Meta Descriptions & OpenGraph",
            description:
              "Meta descriptions and OpenGraph tags let agents summarize your page without reading the full HTML. Agents use these to decide whether a page is relevant before committing tokens to parse it.",
          },
          {
            title: "Heading Hierarchy",
            description:
              "Agents fold and navigate content by heading level. A clear h1 → h2 → h3 hierarchy lets them skip to relevant sections instead of reading the entire page sequentially.",
          },
          {
            title: "Canonical URL",
            description:
              "A canonical URL tells agents which version of a page is authoritative. Without it, agents may waste tokens on duplicate content or cite the wrong URL.",
          },
        ],
      },
      {
        heading: "Readability",
        checks: [
          {
            title: "Markdown Content Negotiation",
            description:
              "When a server responds to Accept: text/markdown with clean markdown, agents get your content at ~80% fewer tokens than raw HTML. This is the single biggest efficiency win for AI consumption.",
            link: "https://blog.cloudflare.com/markdown-for-ai-agents/",
            linkLabel: "Cloudflare Markdown for Agents",
          },
          {
            title: "Token Efficiency",
            description:
              "This measures how much of your HTML is actual content vs. framework noise — CSS classes, nested divs, scripts. Low ratios mean agents burn most of their context window on markup instead of your content.",
          },
          {
            title: "Content Extraction Quality",
            description:
              "Agents extract your main content by looking for <main> or <article> elements. Without these semantic wrappers, they pull in navigation, footers, and sidebars — adding noise and wasting tokens.",
          },
          {
            title: "Semantic HTML",
            description:
              "Semantic elements like <main>, <nav>, <article>, and <section> give agents a structural map of your page. Generic <div> containers provide no hints about what content they hold.",
          },
          {
            title: "Page Token Footprint",
            description:
              "Every page an agent reads consumes context window tokens. Lighter pages leave more room for conversation history and multi-step workflows. Pages over 30k tokens can exhaust smaller model context windows entirely.",
          },
        ],
      },
      {
        heading: "Permissions",
        checks: [
          {
            title: "AI Crawler Policy (robots.txt)",
            description:
              "robots.txt controls which crawlers can access your site. Blocking AI crawlers like GPTBot and ClaudeBot prevents your content from appearing in AI answers and agent workflows.",
          },
          {
            title: "Content-Signal Header",
            description:
              "The Content-Signal header explicitly declares whether your content can be used for AI training, search, and input. Without it, agents must guess your permissions or apply conservative defaults.",
            link: "https://contentsignals.org",
            linkLabel: "Content Signals spec",
          },
        ],
      },
      {
        heading: "Interactability",
        checks: [
          {
            title: "Labeled Form Inputs",
            description:
              "Form inputs without labels are invisible to AI agents. Agents rely on label text and aria-label to understand what data each field expects and fill forms correctly.",
          },
          {
            title: "Descriptive Button & Link Text",
            description:
              "Buttons labeled \"Click here\" or \"Learn more\" don't tell an agent what the action does. Descriptive text like \"Download pricing guide\" lets agents choose the right action confidently.",
          },
          {
            title: "API Documentation",
            description:
              "Exposed API docs (OpenAPI, Swagger, GraphQL) let agents interact with your service programmatically instead of navigating a UI. This is the most reliable path for agent automation.",
          },
        ],
      },
      {
        heading: "Accessibility for Agents",
        checks: [
          {
            title: "ARIA Labels on Interactive Elements",
            description:
              "AI agents read pages through the accessibility tree, just like screen readers. Elements without accessible names are invisible or ambiguous to agents.",
          },
          {
            title: "Landmark Roles",
            description:
              "Landmark roles — <main>, <nav>, <header>, <footer> — let agents jump directly to relevant page sections. Without landmarks, an agent must scan every element sequentially.",
          },
          {
            title: "Keyboard-Reachable Elements",
            description:
              "Agents interact with pages through keyboard-like actions: tab, enter, arrow keys. Interactive elements that aren't keyboard-reachable are effectively unusable by agents.",
          },
          {
            title: "Consistent Navigation",
            description:
              "A named <nav> element with a clear aria-label helps agents parse your site's navigation. This lets them discover pages and understand your information architecture.",
          },
        ],
      },
    ],
  },
  {
    heading: "WebMCP Readiness",
    slug: "webmcp",
    intro:
      "Does your site expose tools for AI agents to call directly? WebMCP lets pages register functions — like \"add to cart\" or \"search\" — that agents invoke without navigating a UI.",
    subcategories: [
      {
        heading: "Tool Integration",
        checks: [
          {
            title: "WebMCP Meta Tag",
            description:
              "A WebMCP meta tag tells visiting agents that your page exposes tools they can call. Without this signal, agents won't know to look for WebMCP capabilities.",
          },
          {
            title: "WebMCP API in Scripts",
            description:
              "References to navigator.modelContext in your scripts indicate your page implements the WebMCP API. This is the runtime interface agents use to discover and call your tools.",
          },
          {
            title: "Registered Tools",
            description:
              "Registered WebMCP tools are functions your page exposes for agents to call directly — like \"add to cart\", \"search\", or \"filter results\". No tools means agents can only read, not act.",
          },
          {
            title: "Tool Descriptions & Schemas",
            description:
              "Agents choose which tools to call based on descriptions and input schemas. Missing or vague descriptions lead agents to call the wrong tool or pass bad parameters.",
          },
          {
            title: "Page State via provideContext()",
            description:
              "provideContext() shares your page's current state — selected filters, user info, cart contents — with agents. Without it, agents must infer state from the DOM, which is error-prone.",
          },
        ],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AgentReadinessGuide() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = useCallback((slug: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) {
        next.delete(slug);
      } else {
        next.add(slug);
      }
      return next;
    });
  }, []);

  return (
    <section className="mt-16 mb-8">
      {/* Section divider */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#E8E4DC] to-transparent" />
        <h2 className="text-lg sm:text-xl font-semibold text-[#1A1A1A] shrink-0">
          What we check &mdash; and why it matters
        </h2>
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#E8E4DC] to-transparent" />
      </div>
      <p className="text-center text-sm text-[#6B6B6B] max-w-2xl mx-auto mb-10 leading-relaxed">
        AI agents interact with websites differently than humans. They read
        through accessibility trees, parse structured data, and consume entire
        pages as tokens. Here&apos;s every signal we evaluate.
      </p>

      <div className="space-y-3">
        {GUIDE_CATEGORIES.map((category) => {
          const isOpen = expanded.has(category.slug);
          return (
            <article
              key={category.slug}
              className="bg-white border border-[#E8E4DC] rounded-xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
            >
              {/* Clickable category header */}
              <button
                type="button"
                onClick={() => toggle(category.slug)}
                className={cn(
                  "w-full text-left px-5 sm:px-7 py-5 flex items-center justify-between gap-4",
                  "hover:bg-[#FAFAF8] transition-colors duration-150",
                  isOpen && "border-b border-[#F0EDE8]"
                )}
              >
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold text-[#1A1A1A]">
                    {category.heading}
                  </h3>
                  <p className="text-sm text-[#6B6B6B] mt-1 leading-relaxed">
                    {category.intro}
                  </p>
                </div>
                <ChevronDown
                  className={cn(
                    "h-5 w-5 shrink-0 text-[#999] transition-transform duration-200",
                    isOpen && "rotate-180"
                  )}
                />
              </button>

              {/* Collapsible subcategories */}
              <div
                className={cn(
                  "grid transition-[grid-template-rows] duration-300 ease-in-out",
                  isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                )}
              >
                <div className="overflow-hidden">
                  <div className="px-5 sm:px-7 pb-6 pt-5 space-y-6 bg-gradient-to-b from-[#FDFCFB] to-white">
                    {category.subcategories.map((sub) => (
                      <div key={sub.heading}>
                        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[#B0A99F] mb-3">
                          {sub.heading}
                        </h4>
                        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                          {sub.checks.map((check) => (
                            <div key={check.title} className="min-w-0">
                              <dt className="text-sm font-medium text-[#1A1A1A]">
                                {check.title}
                              </dt>
                              <dd className="text-sm text-[#6B6B6B] mt-0.5 leading-relaxed">
                                {check.description}
                                {check.link && (
                                  <a
                                    href={check.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[#FF6E00] hover:text-[#E06200] ml-1 whitespace-nowrap"
                                  >
                                    {check.linkLabel || "Learn more"}
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                )}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
