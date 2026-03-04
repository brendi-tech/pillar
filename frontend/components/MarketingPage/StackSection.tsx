"use client";

import { useEffect, useRef, useState } from "react";
import {
  motion,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { GridBackground } from "./GridBackground";
import { NumberedHeading } from "./NumberedHeading";

const PROMPT_TEXT = "How do I add a copilot to my app?";

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
    title: "Frontend Components",
    description: "Drop-in React sidebar. Your components, your auth.",
  },
  {
    title: "Reasoning Engine",
    description: "Agent backend that plans, reasons, and calls your tools.",
  },
  {
    title: "Knowledge Base",
    description: "Your docs crawled, chunked, and always current.",
  },
  {
    title: "Agent-Ready",
    description:
      "WebMCP lets browser agents like Gemini, Comet, and others interact with your app too.",
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
const LAYER_ICONS = [ComponentIcon, BrainIcon, BookIcon, GlobeIcon];

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
// Section separator with numbered heading (matches other marketing sections)
// ---------------------------------------------------------------------------

const GRADIENT_LINE_BG =
  "linear-gradient(90deg, rgba(212,212,212,0) 0%, #D4D4D4 30%, #D4D4D4 70%, rgba(212,212,212,0) 100%)";


// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SearchPrompt() {
  return (
    <div
      className="absolute left-1/2 top-[7%] z-10 w-full max-w-lg -translate-x-1/2 px-4 md:px-0"
    >
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

// Both titles share this vertical position so they swap in place
const TITLE_TOP = "top-[24%] md:top-[28%]";

function OldWayDivider({ progress }: { progress: MotionValue<number> }) {
  const opacity = useTransform(progress, [0.02, 0.06, 0.38, 0.42], [0, 1, 1, 0]);
  const scaleX = useTransform(progress, [0.02, 0.06], [0, 1]);

  return (
    <motion.div
      className="absolute left-1/2 top-[22%] z-10 w-full max-w-[200px] -translate-x-1/2 md:max-w-[280px]"
      style={{ opacity }}
    >
      <motion.div
        className="h-px w-full"
        style={{
          scaleX,
          transformOrigin: "center center",
          background: "linear-gradient(90deg, transparent, #D4D4D4, transparent)",
        }}
      />
    </motion.div>
  );
}

function OldWayTitle({ progress }: { progress: MotionValue<number> }) {
  const opacity = useTransform(progress, [0.03, 0.07, 0.38, 0.42], [0, 1, 1, 0]);
  const y = useTransform(progress, [0.03, 0.07], [30, 0]);

  return (
    <motion.h2
      className={`absolute left-1/2 ${TITLE_TOP} z-10 whitespace-nowrap font-editorial text-3xl tracking-tight text-[#1D1D1F] md:text-5xl`}
      style={{ opacity, y, x: "-50%" }}
    >
      The old way
    </motion.h2>
  );
}

function ToolCard({
  index,
  progress,
  mobile,
}: {
  index: number;
  progress: MotionValue<number>;
  mobile: boolean;
}) {
  const tool = TOOL_BOXES[index];
  const Icon = TOOL_ICONS[index];

  const entryStart = 0.06 + index * 0.06;
  const entryEnd = entryStart + 0.05;

  const opacity = useTransform(
    progress,
    [entryStart, entryEnd, 0.38, 0.43],
    [0, 1, 1, 0]
  );

  const xSlide = useTransform(
    progress,
    [entryStart, entryEnd, 0.38, 0.43],
    [100, 0, 0, 0]
  );

  const collapseScale = useTransform(progress, [0.38, 0.43], [1, 0.7]);

  const offsetX = mobile ? index * -20 : index * -100;
  const offsetY = mobile ? index * 90 : index * 150;
  const cardHalfW = mobile ? 130 : 130;

  return (
    <motion.div
      className="absolute left-1/2 w-[260px] sm:w-[300px] md:w-[340px]"
      style={{
        opacity,
        x: useTransform(xSlide, (v) => v + offsetX - cardHalfW),
        y: offsetY,
        scale: collapseScale,
      }}
    >
      <div
        className="rounded-2xl border border-black/[0.06] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_20px_rgba(0,0,0,0.06)] md:p-5"
        style={{
          transform: mobile
            ? "perspective(800px) rotateX(4deg) rotateY(-6deg)"
            : "perspective(800px) rotateX(8deg) rotateY(-12deg)",
          transformOrigin: "center center",
        }}
      >
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
    </motion.div>
  );
}

function ToolCardsContainer({ progress, mobile }: { progress: MotionValue<number>; mobile: boolean }) {
  return (
    <div className="absolute left-1/2 top-[32%] md:top-[36%]">
      {TOOL_BOXES.map((_, i) => (
        <ToolCard key={i} index={i} progress={progress} mobile={mobile} />
      ))}
    </div>
  );
}

function OldWayCaption({ progress }: { progress: MotionValue<number> }) {
  const opacity = useTransform(progress, [0.22, 0.25, 0.38, 0.42], [0, 1, 1, 0]);
  const y = useTransform(progress, [0.22, 0.25], [12, 0]);

  return (
    <motion.div
      className="absolute bottom-[3%] left-1/2 z-10 w-full max-w-md px-4 md:bottom-[10%] md:px-0"
      style={{ opacity, y, x: "-50%" }}
    >
      <div className="flex items-center justify-center gap-3 text-[10px] font-medium uppercase tracking-[0.06em] text-[#86868B] md:gap-6 md:text-sm md:tracking-[0.08em]">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-1 w-1 rounded-full bg-[#C4C4C4]" />
          Fragile glue code
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-1 w-1 rounded-full bg-[#C4C4C4]" />
          3+ vendors to manage
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-1 w-1 rounded-full bg-[#C4C4C4]" />
          Endless edge cases
        </span>
      </div>
    </motion.div>
  );
}

function DividerWithLogo({ progress }: { progress: MotionValue<number> }) {
  const opacity = useTransform(progress, [0.42, 0.47], [0, 1]);
  const scaleX = useTransform(progress, [0.42, 0.47], [0, 1]);
  const logoScale = useTransform(progress, [0.43, 0.47], [0.5, 1]);

  return (
    <motion.div
      className="absolute left-1/2 top-[14%] z-10 flex w-full max-w-sm -translate-x-1/2 items-center px-6 md:top-[20%] md:max-w-lg md:px-4"
      style={{ opacity }}
    >
      <motion.div
        className="h-[2px] flex-1"
        style={{
          scaleX,
          transformOrigin: "right center",
          background: "linear-gradient(90deg, transparent, #FF6E00)",
        }}
      />
      <div className="mx-3 shrink-0">
        <motion.div style={{ scale: logoScale }}>
          <PillarLogoMark />
        </motion.div>
      </div>
      <motion.div
        className="h-[2px] flex-1"
        style={{
          scaleX,
          transformOrigin: "left center",
          background: "linear-gradient(90deg, #FF6E00, transparent)",
        }}
      />
    </motion.div>
  );
}

function PillarWayTitle({ progress }: { progress: MotionValue<number> }) {
  const opacity = useTransform(progress, [0.46, 0.50], [0, 1]);
  const y = useTransform(progress, [0.46, 0.50], [20, 0]);

  return (
    <motion.h2
      className={`absolute left-1/2 ${TITLE_TOP} z-10 whitespace-nowrap font-editorial text-3xl tracking-tight text-[#1D1D1F] md:text-5xl`}
      style={{ opacity, y, x: "-50%" }}
    >
      The Pillar way
    </motion.h2>
  );
}

function PillarContainer({ progress }: { progress: MotionValue<number> }) {
  const containerOpacity = useTransform(progress, [0.49, 0.54], [0, 1]);
  const containerScale = useTransform(progress, [0.49, 0.54], [0.92, 1]);
  const containerY = useTransform(progress, [0.49, 0.54], [20, 0]);

  return (
    <motion.div
      className="absolute left-1/2 top-[30%] z-10 w-full max-w-sm px-4 md:top-[36%] md:max-w-lg md:px-0"
      style={{
        opacity: containerOpacity,
        scale: containerScale,
        y: containerY,
        x: "-50%",
      }}
    >
      <div className="rounded-2xl border border-black/[0.04] bg-white/90 p-5 shadow-[0_4px_24px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.03)] backdrop-blur-2xl md:p-8">
        {PILLAR_LAYERS.map((layer, i) => {
          const layerStart = 0.53 + i * 0.03;
          const layerEnd = layerStart + 0.08;
          return (
            <PillarLayer
              key={i}
              index={i}
              layer={layer}
              progress={progress}
              entryRange={[layerStart, layerEnd]}
            />
          );
        })}
      </div>
    </motion.div>
  );
}

function PillarLayer({
  index,
  layer,
  progress,
  entryRange,
}: {
  index: number;
  layer: (typeof PILLAR_LAYERS)[number];
  progress: MotionValue<number>;
  entryRange: [number, number];
}) {
  const Icon = LAYER_ICONS[index];
  const opacity = useTransform(progress, entryRange, [0, 1]);
  const y = useTransform(progress, entryRange, [12, 0]);

  return (
    <motion.div style={{ opacity, y }}>
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
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Model provider logos
// ---------------------------------------------------------------------------

const MODEL_PROVIDERS = [
  { name: "OpenAI", domain: "openai.com" },
  { name: "Anthropic", domain: "anthropic.com" },
  { name: "Google", domain: "deepmind.google" },
  { name: "Meta", domain: "ai.meta.com" },
  { name: "Mistral", domain: "mistral.ai" },
  { name: "Cohere", domain: "cohere.com" },
  { name: "Groq", domain: "groq.com" },
];

function ModelProviderLogos({ progress }: { progress: MotionValue<number> }) {
  const opacity = useTransform(progress, [0.66, 0.70], [0, 1]);
  const y = useTransform(progress, [0.66, 0.70], [16, 0]);

  return (
    <motion.div
      className="absolute left-1/2 top-[82%] z-10 w-full max-w-lg px-4 md:top-[80%] md:px-0"
      style={{ opacity, y, x: "-50%" }}
    >
      <p className="mb-3 text-center text-xs font-medium uppercase tracking-[0.08em] text-[#86868B]">
        Works with every major model
      </p>
      <div className="flex items-center justify-center gap-5 md:gap-7">
        {MODEL_PROVIDERS.map((provider) => (
          <span
            key={provider.name}
            className="flex items-center gap-1.5 text-xs text-[#6B6B6B] md:text-sm"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://www.google.com/s2/favicons?domain=${provider.domain}&sz=32`}
              alt={provider.name}
              width={18}
              height={18}
              className="rounded-sm opacity-60 grayscale"
            />
            <span className="hidden sm:inline">{provider.name}</span>
          </span>
        ))}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main Section
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


export function StackSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [stickyTop, setStickyTop] = useState(80);
  const [mobile, setMobile] = useState(false);
  const [stickyHeight, setStickyHeight] = useState("calc(100vh - 80px)");

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      let top: number;
      if (w >= 1024) top = 80;
      else if (w >= 640) top = 64;
      else top = 56;
      setStickyTop(top);
      setMobile(w < 768);
      setStickyHeight(`calc(100dvh - ${top}px)`);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: [`start ${stickyTop}px`, `end end`],
  });

  return (
    <div>
      <SectionSeparator />

      <div ref={containerRef} className="relative h-[500vh] bg-white">
        <div
          className="sticky z-10 overflow-hidden bg-white"
          style={{ top: stickyTop, height: stickyHeight }}
        >
          <div className="relative h-full max-w-marketingSection mx-auto border-x border-marketing bg-white">
            <GridBackground
              className="absolute inset-0 z-0"
              gradients={[
                { x: "50%", y: "50%", radius: "90%", color: "rgba(255,255,255,0.4)" },
              ]}
            />

            <div className="relative z-10 flex justify-center">
              <NumberedHeading className="bg-[#1A1A1A] text-[#FF6E00]">
                [01] ONE PLATFORM
              </NumberedHeading>
            </div>

            <SearchPrompt />
            <OldWayDivider progress={scrollYProgress} />
            <OldWayTitle progress={scrollYProgress} />
            <ToolCardsContainer progress={scrollYProgress} mobile={mobile} />
            <OldWayCaption progress={scrollYProgress} />
            <DividerWithLogo progress={scrollYProgress} />
            <PillarWayTitle progress={scrollYProgress} />
            <PillarContainer progress={scrollYProgress} />
            <ModelProviderLogos progress={scrollYProgress} />
          </div>
        </div>
      </div>
    </div>
  );
}
