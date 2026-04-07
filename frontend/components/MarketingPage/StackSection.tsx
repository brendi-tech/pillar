import { GridBackground } from "./GridBackground";
import { NumberedHeading } from "./NumberedHeading";

const PROMPT_TEXT = "I have tools. Now what?";

const TOOL_BOXES = [
  {
    title: "Frontend SDK",
    command: "npm install @copilotkit/react",
    accent: "#3B82F6",
    alternatives: [
      { name: "CopilotKit", domain: "copilotkit.ai" },
      { name: "Vercel AI SDK", domain: "vercel.com" },
      { name: "OpenAI ChatKit", domain: "openai.com" },
    ],
  },
  {
    title: "Agent Framework",
    command: "pip install langchain",
    accent: "#8B5CF6",
    alternatives: [
      { name: "LangChain", domain: "langchain.com" },
      { name: "LangGraph", domain: "langchain.com" },
      { name: "Mastra", domain: "mastra.ai" },
    ],
  },
  {
    title: "Vector Database",
    command: "pinecone.create_index()",
    accent: "#10B981",
    alternatives: [
      { name: "Pinecone", domain: "pinecone.io" },
      { name: "pgvector", domain: "github.com" },
      { name: "Weaviate", domain: "weaviate.io" },
    ],
  },
];

const PILLAR_LAYERS = [
  {
    title: "Tools",
    description:
      "Bring your MCP server, point at your OpenAPI spec, or define tools in code. All three feed into the same agent.",
  },
  {
    title: "Knowledge",
    description:
      "Crawl your docs, connect content sources, auto-index. Every agent searches the same knowledge base.",
  },
  {
    title: "Reasoning Engine",
    description:
      "Plans, selects tools, chains multi-step actions. You bring the APIs — Pillar orchestrates.",
  },
  {
    title: "Control Plane",
    description:
      "Dashboard for agent config, analytics, conversations, and identity. One place to manage everything.",
  },
  {
    title: "Channels",
    description:
      "Deploys to Slack, Discord, your app, MCP, CLI — and whatever's next. Change once, update everywhere.",
  },
];

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

const SearchIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const BrowserIcon = ({ color }: { color: string }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2" y="3" width="20" height="18" rx="2" ry="2" />
    <line x1="2" y1="9" x2="22" y2="9" />
    <circle cx="6" cy="6" r="0.8" fill={color} stroke="none" />
    <circle cx="9" cy="6" r="0.8" fill={color} stroke="none" />
    <circle cx="12" cy="6" r="0.8" fill={color} stroke="none" />
  </svg>
);

const GearIcon = ({ color }: { color: string }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const DatabaseIcon = ({ color }: { color: string }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
  </svg>
);

const ComponentIcon = ({ color }: { color: string }) => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);

const BrainIcon = ({ color }: { color: string }) => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 2a4 4 0 0 1 4 4 4 4 0 0 1-1.5 3.1A4 4 0 0 1 16 13a4 4 0 0 1-2.6 3.7A3 3 0 0 1 12 22a3 3 0 0 1-1.4-5.3A4 4 0 0 1 8 13a4 4 0 0 1 1.5-3.1A4 4 0 0 1 8 6a4 4 0 0 1 4-4z" />
    <path d="M12 2v20" />
  </svg>
);

const BookIcon = ({ color }: { color: string }) => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
);

const GlobeIcon = ({ color }: { color: string }) => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

const TOOL_ICONS = [BrowserIcon, GearIcon, DatabaseIcon];
const LAYER_ICONS = [GearIcon, BookIcon, BrainIcon, ComponentIcon, GlobeIcon];

const maskStyle: React.CSSProperties = { maskType: "alpha" };

const PillarLogoMark = () => (
  <svg width="44" height="44" viewBox="0 0 34 34" fill="none">
    <circle cx="17" cy="17" r="17" fill="#FF6E00" />
    <mask
      id="stack-pillar-mask"
      width="34"
      height="34"
      x="0"
      y="0"
      maskUnits="userSpaceOnUse"
      style={maskStyle}
    >
      <circle cx="17" cy="17" r="17" fill="white" />
    </mask>
    <g mask="url(#stack-pillar-mask)">
      <path
        fill="white"
        d="M9.55 40.56V12.07l6.681-1.77v28.686zM17.306 38.986V10.3l6.967-1.724V40.56z"
      />
    </g>
  </svg>
);

// ---------------------------------------------------------------------------
// Supported channels / surfaces
// ---------------------------------------------------------------------------

const SUPPORTED_CHANNELS = [
  { name: "Slack", domain: "slack.com" },
  { name: "Discord", domain: "discord.com" },
  { name: "Cursor", domain: "cursor.com" },
  { name: "Claude Desktop", domain: "anthropic.com" },
  { name: "Web Copilot", domain: "pillar.so" },
  { name: "MCP", domain: "modelcontextprotocol.io" },
];

const GRADIENT_LINE_BG =
  "linear-gradient(90deg, rgba(212,212,212,0) 0%, #D4D4D4 30%, #D4D4D4 70%, rgba(212,212,212,0) 100%)";

// ---------------------------------------------------------------------------
// Sub-components (static, no scroll animation)
// ---------------------------------------------------------------------------

function SearchPrompt() {
  return (
    <div className="mx-auto w-full max-w-lg px-4 md:px-0">
      <div className="flex items-center gap-3 rounded-2xl border border-black/[0.06] bg-white/90 px-5 py-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_4px_16px_rgba(0,0,0,0.05)] backdrop-blur-xl">
        <span className="text-[#B0B0B0]">
          <SearchIcon />
        </span>
        <span className="text-sm font-normal tracking-[-0.01em] text-[#1D1D1F] md:text-base">
          {PROMPT_TEXT}
        </span>
      </div>
    </div>
  );
}

function OldWayDivider() {
  return (
    <div className="mx-auto w-full max-w-[200px] md:max-w-[280px]">
      <div
        className="h-px w-full"
        style={{
          background: "linear-gradient(90deg, transparent, #D4D4D4, transparent)",
        }}
      />
    </div>
  );
}

function OldWayTitle() {
  return (
    <h2 className="whitespace-nowrap text-center font-editorial text-3xl tracking-tight text-[#1D1D1F] md:text-4xl">
      The old way
    </h2>
  );
}

function ToolCard({ index }: { index: number }) {
  const tool = TOOL_BOXES[index];
  const Icon = TOOL_ICONS[index];

  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_20px_rgba(0,0,0,0.06)] md:p-5">
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px]"
          style={{
            background: `linear-gradient(135deg, ${tool.accent}18, ${tool.accent}08)`,
            boxShadow: `inset 0 0 0 0.5px ${tool.accent}20`,
          }}
        >
          <Icon color={tool.accent} />
        </div>
        <span className="text-base font-semibold tracking-[-0.01em] text-[#1D1D1F] md:text-lg">
          {tool.title}
        </span>
      </div>
      <div className="mt-2.5 rounded-lg bg-[#F8F8F8] px-3 py-2 font-mono text-xs text-[#86868B] md:text-sm">
        {tool.command}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5">
        {tool.alternatives.map((alt) => (
          <span
            key={alt.name}
            className="inline-flex items-center gap-1.5 text-xs text-[#6B6B6B]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://www.google.com/s2/favicons?domain=${alt.domain}&sz=32`}
              alt=""
              width={14}
              height={14}
              className="rounded-sm opacity-70"
            />
            {alt.name}
          </span>
        ))}
      </div>
    </div>
  );
}

function OldWayCaption() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[10px] font-medium uppercase tracking-[0.06em] text-[#86868B] md:gap-x-5 md:text-xs md:tracking-[0.08em]">
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-1 w-1 rounded-full bg-[#C4C4C4]" />
        Nothing shared under the hood
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-1 w-1 rounded-full bg-[#C4C4C4]" />
        Rebuilt per channel
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-1 w-1 rounded-full bg-[#C4C4C4]" />
        Updates don&apos;t propagate
      </span>
    </div>
  );
}

function HorizontalDividerWithLogo() {
  return (
    <div className="flex w-full items-center px-6">
      <div
        className="h-[2px] flex-1"
        style={{
          background: "linear-gradient(90deg, transparent, #FF6E00)",
        }}
      />
      <div className="mx-3 shrink-0">
        <PillarLogoMark />
      </div>
      <div
        className="h-[2px] flex-1"
        style={{
          background: "linear-gradient(90deg, #FF6E00, transparent)",
        }}
      />
    </div>
  );
}

function VerticalDividerWithLogo() {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-8">
      <div
        className="w-[2px] flex-1"
        style={{
          background: "linear-gradient(180deg, transparent, #FF6E00)",
        }}
      />
      <div className="my-4 shrink-0">
        <PillarLogoMark />
      </div>
      <div
        className="w-[2px] flex-1"
        style={{
          background: "linear-gradient(180deg, #FF6E00, transparent)",
        }}
      />
    </div>
  );
}

function PillarWayTitle() {
  return (
    <h2 className="whitespace-nowrap text-center font-editorial text-3xl tracking-tight text-[#1D1D1F] md:text-4xl">
      The Pillar way
    </h2>
  );
}

function PillarLayer({
  index,
  layer,
}: {
  index: number;
  layer: (typeof PILLAR_LAYERS)[number];
}) {
  const Icon = LAYER_ICONS[index];

  return (
    <div>
      {index > 0 && (
        <div
          className="my-3.5 h-px md:my-5"
          style={{
            background:
              "linear-gradient(90deg, transparent 4%, rgba(0,0,0,0.06) 25%, rgba(0,0,0,0.06) 75%, transparent 96%)",
          }}
        />
      )}
      <div className="flex items-center gap-3 md:gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full md:h-11 md:w-11 bg-gradient-to-br from-[#FF6E00]/[0.12] to-[#FF6E00]/[0.03] shadow-[0_0_0_1px_rgba(255,110,0,0.1),0_2px_6px_rgba(255,110,0,0.06)]">
          <Icon color="#FF6E00" />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold tracking-[-0.02em] text-[#1D1D1F] md:text-base">
            {layer.title}
          </span>
          <span className="text-xs leading-relaxed text-[#86868B] md:text-sm">
            {layer.description}
          </span>
        </div>
      </div>
    </div>
  );
}

function PillarLayersCard() {
  return (
    <div className="rounded-2xl border border-black/[0.04] bg-white/90 p-5 shadow-[0_4px_24px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.03)] backdrop-blur-2xl md:p-8">
      {PILLAR_LAYERS.map((layer, i) => (
        <PillarLayer key={i} index={i} layer={layer} />
      ))}
    </div>
  );
}

function ChannelLogos() {
  return (
    <div className="mt-6 md:mt-8">
      <p className="mb-3 text-center text-xs font-medium uppercase tracking-[0.08em] text-[#86868B]">
        Ship to all of these out of the box
      </p>
      <div className="flex flex-wrap items-center justify-center gap-5 md:gap-7">
        {SUPPORTED_CHANNELS.map((channel) => (
          <span
            key={channel.name}
            className="flex items-center gap-1.5 text-xs text-[#6B6B6B] md:text-sm"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://www.google.com/s2/favicons?domain=${channel.domain}&sz=32`}
              alt={channel.name}
              width={18}
              height={18}
              className="rounded-sm opacity-60 grayscale"
            />
            <span className="hidden sm:inline">{channel.name}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Column composites
// ---------------------------------------------------------------------------

function OldWayColumn() {
  return (
    <div className="flex flex-col items-center gap-5 opacity-55 grayscale-[20%]">
      <OldWayDivider />
      <OldWayTitle />
      <div className="flex w-full flex-col gap-4 px-2">
        {TOOL_BOXES.map((_, i) => (
          <ToolCard key={i} index={i} />
        ))}
      </div>
      <OldWayCaption />
    </div>
  );
}

function PillarWayColumn() {
  return (
    <div className="flex flex-col items-center gap-5">
      <div className="mx-auto w-full max-w-[200px] md:max-w-[280px]">
        <div
          className="h-px w-full"
          style={{
            background: "linear-gradient(90deg, transparent, #FF6E00, transparent)",
          }}
        />
      </div>
      <PillarWayTitle />
      <div className="w-full px-2">
        <PillarLayersCard />
      </div>
      <ChannelLogos />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section separator
// ---------------------------------------------------------------------------

function SectionSeparator() {
  return (
    <div className="relative">
      <div className="h-[1px] w-full" style={{ background: GRADIENT_LINE_BG }} />
      <div className="max-w-marketingSection mx-auto bg-white h-10 border-x border-marketing relative" />
      <div className="h-[1px] w-full" style={{ background: GRADIENT_LINE_BG }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Section
// ---------------------------------------------------------------------------

export function StackSection() {
  return (
    <div>
      <SectionSeparator />

      <div className="relative bg-white">
        <div className="relative max-w-marketingSection mx-auto border-x border-marketing bg-white">
          <GridBackground
            className="absolute inset-0 z-0"
            gradients={[
              { x: "50%", y: "50%", radius: "90%", color: "rgba(255,255,255,0.4)" },
            ]}
          />

          <div className="relative z-10 flex justify-center pt-0 pb-2">
            <NumberedHeading className="bg-[#1A1A1A] text-[#FF6E00]">
              [01] THE CONTROL PLANE
            </NumberedHeading>
          </div>

          <div className="relative z-10 py-6 md:py-8">
            <SearchPrompt />
          </div>

          {/* Desktop: side-by-side */}
          <div className="relative z-10 hidden md:grid md:grid-cols-[1fr_auto_1fr] pb-16 pt-4">
            <OldWayColumn />
            <VerticalDividerWithLogo />
            <PillarWayColumn />
          </div>

          {/* Mobile: stacked */}
          <div className="relative z-10 flex flex-col gap-10 px-4 pb-12 pt-2 md:hidden">
            <OldWayColumn />
            <HorizontalDividerWithLogo />
            <PillarWayColumn />
          </div>
        </div>
      </div>
    </div>
  );
}
