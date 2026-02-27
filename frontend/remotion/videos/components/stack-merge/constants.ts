export const STACK_MERGE_DIMENSIONS = { width: 1400, height: 800 };
export const STACK_MERGE_FPS = 30;
export const STACK_MERGE_DURATION = 450; // 15 seconds

// Scene timing (frame numbers)
export const SCENES = {
  question: { start: 0, typingStart: 15, end: 75 },
  answer: {
    box1: 75,
    box2: 95,
    box3: 115,
    connectionsStart: 135,
    alternativesStart: 145,
    timeStart: 160,
    end: 180,
  },
  pain: { start: 180, end: 255 },
  merge: {
    fadeLines: 255,
    fadeBoxes: 260,
    pillarIn: 285,
    end: 310,
  },
  reveal: {
    layer1: 340,
    layer2: 362,
    layer3: 384,
    webmcp: 410,
    end: 430,
  },
  hold: { start: 430, end: 450 },
} as const;

export const PROMPT_TEXT = "How do I add a copilot to my app?";

export const TOOL_BOXES = [
  {
    title: "Frontend SDK",
    command: "npm install @copilotkit/react",
    accent: "#3B82F6",
    accentRgb: "59, 130, 246",
    alternatives: ["CopilotKit", "AG-UI", "Custom React"],
    timeWeeks: "4–6 weeks",
  },
  {
    title: "Agent Framework",
    command: "pip install langchain",
    accent: "#8B5CF6",
    accentRgb: "139, 92, 246",
    alternatives: ["LangChain", "CrewAI", "AutoGen"],
    timeWeeks: "6–10 weeks",
  },
  {
    title: "Vector Database",
    command: "pinecone.create_index()",
    accent: "#10B981",
    accentRgb: "16, 185, 129",
    alternatives: ["Pinecone", "Weaviate", "Chroma"],
    timeWeeks: "2–4 weeks",
  },
] as const;

export const CONNECTION_LABELS = ["webhooks", "API keys", "embed pipeline"];

export const PILLAR_LAYERS = [
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
] as const;

export const COLORS = {
  background: "#FAFAFA",
  orange: "#FF6E00",
  orangeRgb: "255, 110, 0",
  textPrimary: "#1D1D1F",
  textSecondary: "#3A3A3C",
  textMuted: "#86868B",
  border: "rgba(0, 0, 0, 0.08)",
  cardBg: "rgba(255, 255, 255, 0.7)",
} as const;

// Layout
export const BOX_WIDTH = 340;
export const BOX_HEIGHT = 155;
export const BOX_GAP = 20;
export const PILLAR_CONTAINER_WIDTH = 560;
