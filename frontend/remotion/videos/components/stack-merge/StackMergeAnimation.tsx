import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import { FONT, MONO_FONT } from "../launch-overlays/fonts";
import {
  SCENES,
  PROMPT_TEXT,
  TOOL_BOXES,
  CONNECTION_LABELS,
  PILLAR_LAYERS,
  COLORS,
  BOX_WIDTH,
  BOX_HEIGHT,
  BOX_GAP,
  PILLAR_CONTAINER_WIDTH,
  STACK_MERGE_DIMENSIONS,
  STACK_MERGE_DURATION,
} from "./constants";

export { STACK_MERGE_DIMENSIONS, STACK_MERGE_DURATION };

const CX = 640;
const SPACING = BOX_WIDTH + BOX_GAP;

const PROMPT_Y = 70;
const BOXES_Y = 200;

// ---------------------------------------------------------------------------
// Animated Background — gradient blobs + dot pattern
// ---------------------------------------------------------------------------

const AnimatedBackground = ({ frame }: { frame: number }) => {
  // Slow drifting motion for each blob
  const blob1X = 780 + Math.sin(frame * 0.008) * 70;
  const blob1Y = 100 + Math.cos(frame * 0.006) * 40;
  const blob2X = 220 + Math.cos(frame * 0.007) * 60;
  const blob2Y = 500 + Math.sin(frame * 0.005) * 35;
  const blob3X = 640 + Math.sin(frame * 0.01) * 45;
  const blob3Y = 360 + Math.cos(frame * 0.009) * 50;

  // Phase-reactive color intensity
  const painActive = frame >= SCENES.pain.start && frame < SCENES.merge.fadeLines;
  const painProgress = painActive
    ? interpolate(frame, [SCENES.pain.start, SCENES.merge.fadeLines], [0, 1], { extrapolateRight: "clamp" })
    : 0;
  const pillarActive = frame >= SCENES.merge.pillarIn;
  const pillarWarmth = pillarActive
    ? interpolate(frame, [SCENES.merge.pillarIn, SCENES.reveal.layer3], [0, 1], { extrapolateRight: "clamp" })
    : 0;

  // Blob opacities shift with phase
  const warmOpacity = 0.07 + painProgress * 0.06 + pillarWarmth * 0.04;
  const coolOpacity = 0.06 - painProgress * 0.02;
  const accentOpacity = 0.04 + pillarWarmth * 0.06;

  return (
    <>
      {/* Warm peach/orange blob — top right */}
      <div style={{
        position: "absolute",
        left: blob1X - 250, top: blob1Y - 250,
        width: 500, height: 500, borderRadius: "50%",
        background: `radial-gradient(circle, rgba(255, 160, 80, ${warmOpacity}) 0%, transparent 70%)`,
        filter: "blur(80px)",
      }} />

      {/* Cool blue/indigo blob — bottom left */}
      <div style={{
        position: "absolute",
        left: blob2X - 300, top: blob2Y - 300,
        width: 600, height: 600, borderRadius: "50%",
        background: `radial-gradient(circle, rgba(120, 140, 255, ${coolOpacity}) 0%, transparent 70%)`,
        filter: "blur(100px)",
      }} />

      {/* Brand accent blob — center, intensifies during Pillar reveal */}
      <div style={{
        position: "absolute",
        left: blob3X - 200, top: blob3Y - 200,
        width: 400, height: 400, borderRadius: "50%",
        background: `radial-gradient(circle, rgba(${COLORS.orangeRgb}, ${accentOpacity}) 0%, transparent 65%)`,
        filter: "blur(90px)",
      }} />

      {/* Dot pattern overlay */}
      <svg
        width="1280"
        height="720"
        style={{ position: "absolute", top: 0, left: 0 }}
      >
        <defs>
          <pattern
            id="dot-grid"
            x="0"
            y="0"
            width="28"
            height="28"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="1" cy="1" r="0.7" fill="rgba(0,0,0,0.04)" />
          </pattern>
          <radialGradient id="dot-fade" cx="50%" cy="50%" r="65%">
            <stop offset="0%" stopColor="white" stopOpacity="0" />
            <stop offset="100%" stopColor="white" stopOpacity="0.7" />
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#dot-grid)" />
        <rect width="100%" height="100%" fill="url(#dot-fade)" />
      </svg>
    </>
  );
};

// ---------------------------------------------------------------------------
// Real Pillar Logo SVG
// ---------------------------------------------------------------------------

const PillarLogo = ({ width = 120 }: { width?: number }) => {
  const scale = width / 99;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={99 * scale}
      height={34 * scale}
      fill="none"
      viewBox="0 0 99 34"
    >
      <path
        fill="#1A1A1A"
        d="m38.241 27.593.197-.065q.294-.098.49-.262.197-.163.327-.523.131-.393.197-1.014.065-.655.065-1.636V9.73q0-.982-.065-1.603-.066-.655-.197-1.015-.13-.392-.327-.556a1.5 1.5 0 0 0-.49-.261l-.197-.033v-.916h7.002q2.06 0 3.5.392 1.473.36 2.454.982 1.015.621 1.57 1.374.59.72.884 1.472.327.752.393 1.407.098.622.098 1.014 0 1.734-.655 3.141a6.5 6.5 0 0 1-1.897 2.389q-1.21.981-2.945 1.505-1.733.523-3.926.523h-1.995v4.548q0 .981.032 1.636.066.621.197 1.014.13.36.327.523.229.165.523.262l.196.065v.884h-5.758zm6.413-9.062q2.977 0 4.515-1.473 1.57-1.505 1.57-4.35 0-.884-.229-1.964a5.3 5.3 0 0 0-.916-2.061q-.687-.95-1.996-1.603-1.275-.655-3.402-.655h-1.472v12.106zM57.232 9.599a1.96 1.96 0 0 1-1.44-.589 2.07 2.07 0 0 1-.588-1.472q0-.884.589-1.473a1.96 1.96 0 0 1 1.44-.588q.882 0 1.472.588.589.59.589 1.473 0 .85-.622 1.472a1.96 1.96 0 0 1-1.44.589m3.043 17.896v.884h-5.66v-.884l.196-.065q.295-.099.491-.262.23-.163.36-.523.131-.393.196-1.015.066-.654.066-1.636v-7.197q0-.85-.099-1.342-.065-.49-.196-.752-.13-.294-.327-.393a1.4 1.4 0 0 0-.458-.13l-.23-.033v-.884l3.567-1.603.524-.033h.261v12.367q0 .982.066 1.636.065.622.196 1.015.165.36.36.523.196.164.49.262zM66.233 27.495v.884h-5.66v-.884l.196-.065q.295-.099.491-.262.23-.163.36-.523.131-.393.196-1.015.066-.654.066-1.636v-13.38q0-.851-.099-1.31-.065-.49-.196-.752-.13-.294-.327-.393a1.4 1.4 0 0 0-.458-.13l-.229-.033v-.884l3.566-1.635h.785v18.518q0 .982.066 1.635.065.622.196 1.015.165.36.36.523t.49.262zM72.23 27.495v.884h-5.66v-.884l.196-.065q.294-.099.49-.262.23-.163.36-.523.131-.393.197-1.015.065-.654.065-1.636v-13.38q0-.851-.098-1.31-.066-.49-.196-.752-.132-.294-.328-.393a1.4 1.4 0 0 0-.457-.13l-.23-.033v-.884l3.567-1.635h.785v18.518q0 .982.065 1.635.066.622.197 1.015.163.36.36.523.195.164.49.262zM88 27.462v.722h-.753q-.72 0-1.341-.08a4 4 0 0 1-1.113-.294 2.3 2.3 0 0 1-.752-.615q-.296-.373-.36-.935a5.8 5.8 0 0 1-1.374 1.096q-.72.427-1.865.774-1.113.348-2.716.348-1.112 0-2.126-.24a6.2 6.2 0 0 1-1.734-.695 4 4 0 0 1-1.21-1.176q-.427-.72-.426-1.683 0-1.095.687-1.87.72-.801 1.832-1.362a13 13 0 0 1 2.52-.935 54 54 0 0 1 2.813-.721l3.599-.802q0-2.084-.818-3.019-.786-.96-2.748-.961a3.5 3.5 0 0 0-1.407.267 4.5 4.5 0 0 0-1.113.614q-.458.375-.785.828-.327.428-.589.802-.72 1.041-1.701 1.042a2 2 0 0 1-.654-.107 1.12 1.12 0 0 1-.687-.535q-.197-.426.13-.961.263-.455.818-.935.556-.508 1.407-.909a10 10 0 0 1 1.996-.667q1.145-.268 2.552-.268t2.617.348 2.094 1.015q.916.641 1.407 1.603.523.934.523 2.164v5.289q0 .801.033 1.336.066.507.197.828a1 1 0 0 0 .327.427q.229.134.523.214zm-4.32-7.666-3.304.748q-.884.186-1.766.48a6.2 6.2 0 0 0-1.538.775q-.654.48-1.08 1.202-.392.722-.392 1.763 0 .615.261 1.122.296.508.72.882.458.374 1.047.588.622.213 1.243.213 1.244 0 2.094-.294.85-.32 1.407-.72.59-.401.883-.776.328-.373.426-.507zM97.416 14.506q.72.16.949.534.262.348.196.668-.065.4-.425.668-.327.267-.785.267-.262 0-.491-.027a18 18 0 0 0-.49-.106l-.524-.107a2.8 2.8 0 0 0-.556-.054q-1.048 0-1.702.561a3.6 3.6 0 0 0-.981 1.336v6.331q0 .802.065 1.336.066.507.196.828.165.294.36.428.197.134.491.213l.196.054v.721h-5.66v-.721l.197-.054a1.6 1.6 0 0 0 .49-.213.9.9 0 0 0 .36-.428q.13-.321.197-.828.065-.534.065-1.336v-6.09q0-.695-.098-1.096-.066-.4-.197-.614a.7.7 0 0 0-.327-.294 1.7 1.7 0 0 0-.458-.107l-.229-.053V15.6l3.566-1.068.524-.027h.262v1.95q.72-.801 1.8-1.416a4.56 4.56 0 0 1 2.29-.614q.392 0 .72.08"
      />
      <mask id="pillar-mask" width="34" height="34" x="0" y="0" maskUnits="userSpaceOnUse" style={{ maskType: "alpha" } as React.CSSProperties}>
        <circle cx="16.912" cy="16.912" r="16.912" fill="#1A1A1A" />
      </mask>
      <g mask="url(#pillar-mask)">
        <circle cx="16.912" cy="16.912" r="16.405" stroke="#1A1A1A" strokeWidth="1.012" />
        <path fill="#1A1A1A" d="M9.55 40.56V12.07l6.681-1.77v28.686zM17.306 38.986V10.3l6.967-1.724V40.56z" />
      </g>
    </svg>
  );
};

// ---------------------------------------------------------------------------
// SVG Icons
// ---------------------------------------------------------------------------

const BrowserIcon = ({ color }: { color: string }) => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="18" rx="2" ry="2" /><line x1="2" y1="9" x2="22" y2="9" />
    <circle cx="6" cy="6" r="0.8" fill={color} stroke="none" /><circle cx="9" cy="6" r="0.8" fill={color} stroke="none" /><circle cx="12" cy="6" r="0.8" fill={color} stroke="none" />
  </svg>
);

const GearIcon = ({ color }: { color: string }) => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const DatabaseIcon = ({ color }: { color: string }) => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
  </svg>
);

const ComponentIcon = ({ color }: { color: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);

const BrainIcon = ({ color }: { color: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a4 4 0 0 1 4 4 4 4 0 0 1-1.5 3.1A4 4 0 0 1 16 13a4 4 0 0 1-2.6 3.7A3 3 0 0 1 12 22a3 3 0 0 1-1.4-5.3A4 4 0 0 1 8 13a4 4 0 0 1 1.5-3.1A4 4 0 0 1 8 6a4 4 0 0 1 4-4z" />
    <path d="M12 2v20" />
  </svg>
);

const BookIcon = ({ color }: { color: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
);

const InfraIcon = ({ color }: { color: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="5" rx="1" /><rect x="2" y="10" width="20" height="5" rx="1" /><rect x="2" y="17" width="20" height="5" rx="1" />
  </svg>
);

const TOOL_ICONS = [BrowserIcon, GearIcon, DatabaseIcon];
const LAYER_ICONS = [ComponentIcon, BrainIcon, BookIcon];

// ---------------------------------------------------------------------------
// Scene 1: The Question — frosted glass, layered shadows
// ---------------------------------------------------------------------------

const QuestionPrompt = ({ frame, fps }: { frame: number; fps: number }) => {
  const TYPING_DURATION = 28;
  const PAUSE_AFTER = 30;
  const typingFrame = Math.max(0, frame - SCENES.question.typingStart);
  const charsToShow = Math.min(
    PROMPT_TEXT.length,
    Math.floor(interpolate(typingFrame, [0, TYPING_DURATION], [0, PROMPT_TEXT.length], { extrapolateRight: "clamp" }))
  );
  const visibleText = PROMPT_TEXT.slice(0, charsToShow);
  const showCursor = frame >= SCENES.question.typingStart;
  const cursorOpacity = !showCursor ? 0
    : charsToShow < PROMPT_TEXT.length ? 1
    : Math.round(((frame - SCENES.question.typingStart - TYPING_DURATION) / 8) % 2) === 0 ? 1 : 0;

  const inputEntrance = spring({ frame, fps, config: { damping: 20, stiffness: 100 } });

  const zoomOutStart = SCENES.question.typingStart + TYPING_DURATION + PAUSE_AFTER;
  const zoomOut = frame >= zoomOutStart
    ? spring({ frame: frame - zoomOutStart, fps, config: { damping: 22, stiffness: 60 } })
    : 0;
  const promptScale = interpolate(zoomOut, [0, 1], [2.1, 1]);
  const promptY = interpolate(zoomOut, [0, 1], [185, 0]);

  return (
    <div style={{
      position: "absolute", top: PROMPT_Y, left: "50%",
      transform: `translateX(-50%) translateY(${interpolate(inputEntrance, [0, 1], [12, 0]) + promptY}px) scale(${promptScale})`,
      opacity: interpolate(inputEntrance, [0, 1], [0, 1]),
      transformOrigin: "center center",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 14,
        padding: "20px 32px",
        backgroundColor: "rgba(255, 255, 255, 0.88)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderRadius: 18,
        border: "1px solid rgba(0, 0, 0, 0.06)",
        boxShadow: "0 1px 2px rgba(0,0,0,0.03), 0 4px 16px rgba(0,0,0,0.05), 0 16px 48px rgba(0,0,0,0.03)",
      }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#B0B0B0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <span style={{ fontFamily: FONT, fontSize: 26, fontWeight: 400, color: COLORS.textPrimary, letterSpacing: "-0.01em" }}>
          {visibleText}
        </span>
        <span style={{
          width: 2, height: 30, borderRadius: 1,
          background: `linear-gradient(180deg, ${COLORS.textPrimary}, rgba(29, 29, 31, 0.3))`,
          opacity: cursorOpacity, marginLeft: -4,
        }} />
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Scene 2 & 3: Tool Boxes — animated shine border, gradient icon areas
// ---------------------------------------------------------------------------

const ToolBox = ({
  index, frame, fps, boxOpacity,
}: {
  index: number; frame: number; fps: number; boxOpacity: number;
}) => {
  const tool = TOOL_BOXES[index];
  const startFrame = [SCENES.answer.box1, SCENES.answer.box2, SCENES.answer.box3][index];
  const Icon = TOOL_ICONS[index];

  const entrance = spring({ frame: Math.max(0, frame - startFrame), fps, config: { damping: 18, stiffness: 120 } });
  const entryOpacity = interpolate(entrance, [0, 1], [0, 1]);
  const entryY = interpolate(entrance, [0, 1], [24, 0]);

  const positions = [-1, 0, 1];
  const baseX = positions[index] * SPACING;

  const altEntrance = frame >= SCENES.answer.alternativesStart
    ? spring({ frame: Math.max(0, frame - SCENES.answer.alternativesStart - index * 5), fps, config: { damping: 20, stiffness: 140 } })
    : 0;

  const burdenEntrance = frame >= SCENES.answer.burdenStart
    ? spring({ frame: Math.max(0, frame - SCENES.answer.burdenStart - index * 6), fps, config: { damping: 20, stiffness: 140 } })
    : 0;

  const painActive = frame >= SCENES.pain.start && frame < SCENES.merge.fadeLines;
  const painProgress = painActive
    ? interpolate(frame, [SCENES.pain.start, SCENES.merge.fadeLines], [0, 1], { extrapolateRight: "clamp" })
    : 0;

  const shineAngle = ((frame * 2.5 + index * 120) % 360);
  const shineRgb = painActive ? "239, 68, 68" : tool.accentRgb;
  const shineIntensity = painActive ? 0.45 + painProgress * 0.35 : 0.22;

  // Collapse toward center during merge
  const collapseProgress = frame >= SCENES.merge.fadeBoxes
    ? interpolate(frame, [SCENES.merge.fadeBoxes, SCENES.merge.fadeBoxes + 15], [0, 1], { extrapolateRight: "clamp" })
    : 0;
  const collapseX = interpolate(collapseProgress, [0, 1], [baseX, 0]);
  const collapseScale = interpolate(collapseProgress, [0, 1], [1, 0.7]);
  const collapseY = interpolate(collapseProgress, [0, 1], [0, 40]);

  return (
    <div style={{
      position: "absolute", left: "50%", top: BOXES_Y,
      transform: `translateX(calc(-50% + ${collapseX}px)) translateY(${entryY + collapseY}px) scale(${collapseScale})`,
      opacity: entryOpacity * boxOpacity,
      width: BOX_WIDTH,
    }}>
      {/* Shine border — rotating conic gradient creates a sweeping beam */}
      <div style={{
        borderRadius: 18,
        padding: 1.5,
        background: `conic-gradient(from ${shineAngle}deg at 50% 50%, rgba(${shineRgb}, 0.04) 0deg, rgba(${shineRgb}, ${shineIntensity}) 40deg, rgba(${shineRgb}, 0.04) 80deg, transparent 80deg, transparent 360deg)`,
      }}>
        <div style={{
          backgroundColor: "white", borderRadius: 16.5,
          padding: "20px 24px",
          boxShadow: `0 1px 3px rgba(0,0,0,0.04), 0 4px 20px rgba(0,0,0,0.05)${painActive ? `, 0 0 20px rgba(239, 68, 68, ${painProgress * 0.15})` : ""}`,
          display: "flex", flexDirection: "column", gap: 14,
          height: BOX_HEIGHT, boxSizing: "border-box",
          position: "relative", overflow: "hidden",
        }}>
          {/* Top-edge highlight */}
          <div style={{
            position: "absolute", top: 0, left: 20, right: 20, height: 1,
            background: `linear-gradient(90deg, transparent, rgba(${tool.accentRgb}, 0.12), transparent)`,
          }} />

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 11,
              background: `linear-gradient(135deg, rgba(${tool.accentRgb}, 0.1), rgba(${tool.accentRgb}, 0.03))`,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              boxShadow: `inset 0 0 0 0.5px rgba(${tool.accentRgb}, 0.12)`,
            }}>
              <Icon color={tool.accent} />
            </div>
            <span style={{ fontFamily: FONT, fontSize: 22, fontWeight: 600, color: COLORS.textPrimary, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>
              {tool.title}
            </span>
          </div>

          <div style={{ display: "flex", gap: 8, opacity: interpolate(altEntrance, [0, 1], [0, 1]), transform: `translateY(${interpolate(altEntrance, [0, 1], [4, 0])}px)` }}>
            {tool.alternatives.map((alt, i) => (
              <span key={i} style={{
                fontFamily: MONO_FONT, fontSize: 14, fontWeight: 500, color: COLORS.textMuted,
                padding: "4px 10px", backgroundColor: "#F8F8F8", borderRadius: 7,
                border: "0.5px solid rgba(0,0,0,0.06)", whiteSpace: "nowrap",
              }}>
                {alt}
              </span>
            ))}
          </div>

          <div style={{
            display: "flex", alignItems: "center", gap: 7, marginTop: "auto",
            opacity: interpolate(burdenEntrance, [0, 1], [0, 1]),
            transform: `translateY(${interpolate(burdenEntrance, [0, 1], [4, 0])}px)`,
          }}>
            <InfraIcon color={painActive ? "#EF4444" : "#9CA3AF"} />
            <span style={{ fontFamily: MONO_FONT, fontSize: 14, fontWeight: 500, color: painActive ? "#EF4444" : "#9CA3AF" }}>
              {tool.burden}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Connection Lines — animated beam gradients
// ---------------------------------------------------------------------------

const ConnectionLines = ({ frame, fps }: { frame: number; fps: number }) => {
  const lineEntrance = spring({ frame: Math.max(0, frame - SCENES.answer.connectionsStart), fps, config: { damping: 25, stiffness: 90 } });
  const lineOpacity = interpolate(lineEntrance, [0, 1], [0, 0.6]);

  const fadeOut = frame > SCENES.merge.fadeLines
    ? interpolate(frame, [SCENES.merge.fadeLines, SCENES.merge.fadeLines + 20], [1, 0], { extrapolateRight: "clamp" })
    : 1;

  const opacity = lineOpacity * fadeOut;
  if (opacity <= 0) return null;

  const boxMidY = BOXES_Y + BOX_HEIGHT / 2;
  const leftCenter = CX - SPACING;
  const rightCenter = CX + SPACING;
  const leftBoxRight = leftCenter + BOX_WIDTH / 2;
  const centerBoxLeft = CX - BOX_WIDTH / 2;
  const centerBoxRight = CX + BOX_WIDTH / 2;
  const rightBoxLeft = rightCenter - BOX_WIDTH / 2;

  const painActive = frame >= SCENES.pain.start && frame < SCENES.merge.fadeLines;
  const painProgress = painActive
    ? interpolate(frame, [SCENES.pain.start, SCENES.merge.fadeLines], [0, 1], { extrapolateRight: "clamp" })
    : 0;

  const beamPos = ((frame * 1.8) % 100);
  const beamPos2 = ((frame * 1.8 + 50) % 100);

  const baseColor = painActive ? "239, 68, 68" : "0, 0, 0";
  const lowAlpha = painActive ? 0.08 + painProgress * 0.08 : 0.06;
  const highAlpha = painActive ? 0.3 + painProgress * 0.35 : 0.18;

  return (
    <svg width="1280" height="720" style={{ position: "absolute", top: 0, left: 0, opacity }}>
      <defs>
        <linearGradient id="beam-lc" gradientUnits="userSpaceOnUse"
          x1={leftBoxRight + 4} y1={boxMidY} x2={centerBoxLeft - 4} y2={boxMidY}>
          <stop offset={`${Math.max(0, beamPos - 20)}%`} stopColor={`rgba(${baseColor}, ${lowAlpha})`} />
          <stop offset={`${beamPos}%`} stopColor={`rgba(${baseColor}, ${highAlpha})`} />
          <stop offset={`${Math.min(100, beamPos + 20)}%`} stopColor={`rgba(${baseColor}, ${lowAlpha})`} />
        </linearGradient>
        <linearGradient id="beam-cr" gradientUnits="userSpaceOnUse"
          x1={centerBoxRight + 4} y1={boxMidY} x2={rightBoxLeft - 4} y2={boxMidY}>
          <stop offset={`${Math.max(0, beamPos2 - 20)}%`} stopColor={`rgba(${baseColor}, ${lowAlpha})`} />
          <stop offset={`${beamPos2}%`} stopColor={`rgba(${baseColor}, ${highAlpha})`} />
          <stop offset={`${Math.min(100, beamPos2 + 20)}%`} stopColor={`rgba(${baseColor}, ${lowAlpha})`} />
        </linearGradient>
      </defs>

      <line x1={leftBoxRight + 4} y1={boxMidY} x2={centerBoxLeft - 4} y2={boxMidY}
        stroke="url(#beam-lc)" strokeWidth="2" />
      <line x1={centerBoxRight + 4} y1={boxMidY} x2={rightBoxLeft - 4} y2={boxMidY}
        stroke="url(#beam-cr)" strokeWidth="2" />

      {painProgress > 0 && (
        <path
          d={`M ${leftCenter} ${BOXES_Y - 6} Q ${CX} ${BOXES_Y - 55} ${rightCenter} ${BOXES_Y - 6}`}
          stroke={`rgba(239, 68, 68, ${0.1 + painProgress * 0.25})`}
          strokeWidth="1.5" strokeDasharray="4 6" fill="none"
        />
      )}

      {CONNECTION_LABELS.map((label, i) => (
        <text key={label}
          x={CX + (i - 1) * SPACING}
          y={BOXES_Y + BOX_HEIGHT + 32}
          textAnchor="middle"
          style={{ fontFamily: MONO_FONT, fontSize: 15, fontWeight: 500, fill: painActive ? `rgba(239, 68, 68, ${0.4 + painProgress * 0.4})` : "#9CA3AF" }}
        >
          {label}
        </text>
      ))}
    </svg>
  );
};

// ---------------------------------------------------------------------------
// Pillar Container — neon gradient glow border, glassmorphism
// ---------------------------------------------------------------------------

const PillarContainer = ({ frame, fps }: { frame: number; fps: number }) => {
  const enterFrame = SCENES.merge.pillarIn;
  const containerEntrance = spring({ frame: Math.max(0, frame - enterFrame), fps, config: { damping: 22, stiffness: 80, mass: 1.0 } });
  const containerScale = interpolate(containerEntrance, [0, 1], [0.85, 1]);
  const containerOpacity = interpolate(containerEntrance, [0, 1], [0, 1]);

  const glowFrame = Math.max(0, frame - enterFrame - 15);
  const glowPulse = glowFrame > 0 && glowFrame < 40
    ? interpolate(glowFrame, [0, 15, 40], [0, 0.35, 0], { extrapolateRight: "clamp" }) : 0;
  const breathe = frame >= SCENES.hold.start ? 0.15 + 0.1 * Math.sin((frame - SCENES.hold.start) * 0.08) : 0;
  const glowOpacity = Math.max(glowPulse, breathe);

  const wordmarkEntrance = spring({ frame: Math.max(0, frame - enterFrame - 5), fps, config: { damping: 20, stiffness: 120 } });
  const wordmarkOpacity = interpolate(wordmarkEntrance, [0, 1], [0, 1]);
  const wordmarkY = interpolate(wordmarkEntrance, [0, 1], [8, 0]);

  const neonAngle = (Math.max(0, frame - enterFrame) * 2) % 360;

  return (
    <div style={{
      position: "absolute", left: "50%", top: "50%",
      transform: `translate(-50%, -50%) scale(${containerScale})`,
      opacity: containerOpacity, width: PILLAR_CONTAINER_WIDTH,
    }}>
      {/* Neon gradient border — rotating conic gradient glow */}
      <div style={{
        borderRadius: 22,
        padding: 2,
        background: `conic-gradient(from ${neonAngle}deg at 50% 50%, rgba(${COLORS.orangeRgb}, 0.04) 0deg, rgba(${COLORS.orangeRgb}, ${0.3 + glowOpacity * 0.35}) 55deg, rgba(${COLORS.orangeRgb}, 0.04) 110deg, rgba(${COLORS.orangeRgb}, ${0.15 + glowOpacity * 0.15}) 200deg, rgba(${COLORS.orangeRgb}, 0.04) 250deg, transparent 250deg, transparent 360deg)`,
      }}>
        <div style={{
          backgroundColor: "rgba(255, 255, 255, 0.9)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          borderRadius: 20, border: "0.5px solid rgba(0, 0, 0, 0.04)",
          boxShadow: `0 4px 24px rgba(0, 0, 0, 0.06), 0 0 ${16 + glowOpacity * 24}px rgba(${COLORS.orangeRgb}, ${glowOpacity * 0.35}), 0 0 ${44 + glowOpacity * 36}px rgba(${COLORS.orangeRgb}, ${glowOpacity * 0.12})`,
          padding: "36px 40px", display: "flex", flexDirection: "column", gap: 22,
        }}>
          <div style={{ opacity: wordmarkOpacity, transform: `translateY(${wordmarkY}px)` }}>
            <PillarLogo width={160} />
          </div>

          {PILLAR_LAYERS.map((layer, i) => {
            const layerFrame = [SCENES.reveal.layer1, SCENES.reveal.layer2, SCENES.reveal.layer3][i];
            const layerEntrance = spring({ frame: Math.max(0, frame - layerFrame), fps, config: { damping: 18, stiffness: 180 } });
            const layerOpacity = interpolate(layerEntrance, [0, 1], [0, 1]);
            const layerY = interpolate(layerEntrance, [0, 1], [8, 0]);
            const Icon = LAYER_ICONS[i];

            return (
              <div key={i} style={{ opacity: layerOpacity, transform: `translateY(${layerY}px)` }}>
                {i > 0 && (
                  <div style={{
                    height: 1, marginBottom: 18,
                    background: "linear-gradient(90deg, transparent 4%, rgba(0,0,0,0.06) 25%, rgba(0,0,0,0.06) 75%, transparent 96%)",
                  }} />
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "0 4px" }}>
                  <div style={{
                    width: 50, height: 50, borderRadius: 25,
                    background: `radial-gradient(circle at 35% 35%, rgba(${COLORS.orangeRgb}, 0.12), rgba(${COLORS.orangeRgb}, 0.03) 70%)`,
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    boxShadow: `0 0 0 1px rgba(${COLORS.orangeRgb}, 0.1), 0 2px 6px rgba(${COLORS.orangeRgb}, 0.06)`,
                  }}>
                    <Icon color={COLORS.orange} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <span style={{ fontFamily: FONT, fontSize: 21, fontWeight: 600, color: COLORS.textPrimary, letterSpacing: "-0.02em" }}>
                      {layer.title}
                    </span>
                    <span style={{ fontFamily: FONT, fontSize: 16, fontWeight: 400, color: COLORS.textMuted, lineHeight: 1.35 }}>
                      {layer.description}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center", paddingTop: 2,
            opacity: frame >= SCENES.reveal.webmcp
              ? interpolate(
                  spring({ frame: Math.max(0, frame - SCENES.reveal.webmcp), fps, config: { damping: 20, stiffness: 120 } }),
                  [0, 1], [0, 1]
                )
              : 0,
          }}>
            <span style={{
              fontFamily: MONO_FONT, fontSize: 15, fontWeight: 500, color: COLORS.textMuted,
              padding: "7px 18px",
              background: "linear-gradient(135deg, rgba(0,0,0,0.02), rgba(0,0,0,0.04))",
              borderRadius: 20,
              border: "1px solid rgba(0, 0, 0, 0.05)",
            }}>
              + WebMCP — Chrome, Gemini, and any compliant browser
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main Composition
// ---------------------------------------------------------------------------

export const StackMergeAnimation = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const boxFadeOut = frame >= SCENES.merge.fadeBoxes
    ? interpolate(frame, [SCENES.merge.fadeBoxes, SCENES.merge.fadeBoxes + 15], [1, 0], { extrapolateRight: "clamp" })
    : 1;

  const promptFadeOut = frame >= SCENES.answer.box1
    ? interpolate(frame, [SCENES.answer.box1, SCENES.answer.box1 + 40], [1, 0], { extrapolateRight: "clamp" })
    : 1;

  const showToolBoxes = frame >= SCENES.answer.box1 && boxFadeOut > 0;
  const showConnections = frame >= SCENES.answer.connectionsStart && boxFadeOut > 0;
  const showPillar = frame >= SCENES.merge.pillarIn;

  return (
    <AbsoluteFill style={{ backgroundColor: "#FCFCFC" }}>
      <AnimatedBackground frame={frame} />

      {promptFadeOut > 0 && (
        <div style={{ opacity: promptFadeOut }}>
          <QuestionPrompt frame={frame} fps={fps} />
        </div>
      )}

      {showToolBoxes && (
        <div style={{ position: "absolute", width: "100%", height: "100%" }}>
          {TOOL_BOXES.map((_, i) => (
            <ToolBox key={i} index={i} frame={frame} fps={fps} boxOpacity={boxFadeOut} />
          ))}
        </div>
      )}

      {showConnections && <ConnectionLines frame={frame} fps={fps} />}

      {showPillar && <PillarContainer frame={frame} fps={fps} />}
    </AbsoluteFill>
  );
};
