import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import { FONT, MONO_FONT } from "./fonts";

const ORANGE = "#FF6E00";
const GREEN = "#34C759";

export const ARCHITECTURE_DIMENSIONS = { width: 700, height: 700 };
export const ARCHITECTURE_DURATION = 240;

const SERVER_START = 25;
const SERVER_ITEMS_START = 38;
const FLOW_START = 68;
const CLIENT_START = 88;
const CLIENT_ITEMS_START = 98;

const CloudIcon = ({ color }: { color: string }) => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
  </svg>
);

const BrowserIcon = ({ color }: { color: string }) => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="18" rx="2" ry="2" />
    <line x1="2" y1="9" x2="22" y2="9" />
    <circle cx="6" cy="6" r="0.8" fill={color} stroke="none" />
    <circle cx="9" cy="6" r="0.8" fill={color} stroke="none" />
    <circle cx="12" cy="6" r="0.8" fill={color} stroke="none" />
  </svg>
);

const VerticalAnimatedDot = ({
  frame,
  delay,
  startY,
  endY,
  x,
}: {
  frame: number;
  delay: number;
  startY: number;
  endY: number;
  x: number;
}) => {
  const cycleLength = 45;
  const adjustedFrame = Math.max(0, frame - delay);
  const cycleFrame = adjustedFrame % cycleLength;
  const progress = cycleFrame / cycleLength;

  const y = interpolate(progress, [0, 1], [startY, endY]);
  const opacity = interpolate(
    progress,
    [0, 0.1, 0.75, 1],
    [0, 0.7, 0.7, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  if (frame < delay) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: x - 4,
        top: y,
        width: 8,
        height: 8,
        borderRadius: "50%",
        backgroundColor: ORANGE,
        opacity,
      }}
    />
  );
};

type ContainerBoxProps = {
  position: "top" | "bottom";
  icon: React.ReactNode;
  title: string;
  label: string;
  accentColor: string;
  items: string[];
  frame: number;
  fps: number;
  activateFrame: number;
  itemsStartFrame: number;
};

const ContainerBox = ({
  position,
  icon,
  title,
  label,
  accentColor,
  items,
  frame,
  fps,
  activateFrame,
  itemsStartFrame,
}: ContainerBoxProps) => {
  const activateProgress = spring({
    frame: Math.max(0, frame - activateFrame),
    fps,
    config: { damping: 25, stiffness: 100 },
  });

  const borderOpacity = interpolate(activateProgress, [0, 1], [0.12, 0.4]);

  return (
    <div
      style={{
        width: "100%",
        backgroundColor: "rgba(255, 255, 255, 0.6)",
        borderRadius: 18,
        border: `1.5px solid`,
        borderColor: `rgba(${accentColor === ORANGE ? "255,110,0" : "52,199,89"}, ${borderOpacity})`,
        padding: "20px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 13,
            backgroundColor: `rgba(${accentColor === ORANGE ? "255,110,0" : "52,199,89"}, 0.08)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {icon}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span
            style={{
              fontFamily: FONT,
              fontSize: 28,
              fontWeight: 600,
              color: "#1D1D1F",
              letterSpacing: "-0.02em",
            }}
          >
            {title}
          </span>
          <span
            style={{
              fontFamily: FONT,
              fontSize: 18,
              fontWeight: 500,
              color: accentColor,
              letterSpacing: "0.01em",
            }}
          >
            {label}
          </span>
        </div>
      </div>

      {/* Items */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
        {items.map((text, i) => {
          const itemFrame = itemsStartFrame + i * 12;
          const itemEntrance = spring({
            frame: Math.max(0, frame - itemFrame),
            fps,
            config: { damping: 18, stiffness: 180 },
          });
          const itemOpacity = interpolate(itemEntrance, [0, 1], [0, 1]);
          const itemY = interpolate(
            itemEntrance,
            [0, 1],
            [position === "top" ? -8 : 8, 0]
          );

          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 18px",
                backgroundColor: `rgba(${accentColor === ORANGE ? "255,110,0" : "52,199,89"}, 0.05)`,
                borderRadius: 10,
                opacity: itemOpacity,
                transform: `translateY(${itemY}px)`,
                alignSelf: "stretch",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" fill={accentColor} fillOpacity="0.15" />
                <polyline
                  points="8,12 11,15 16,9"
                  stroke={accentColor}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
              <span
                style={{
                  fontFamily: FONT,
                  fontSize: 20,
                  fontWeight: 500,
                  color: "#3A3A3C",
                  whiteSpace: "nowrap",
                }}
              >
                {text}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const ArchitectureDiagram = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame,
    fps,
    config: { damping: 22, stiffness: 90 },
  });
  const entranceScale = interpolate(entrance, [0, 1], [0.99, 1]);

  const arrowLabelEntrance = spring({
    frame: Math.max(0, frame - FLOW_START),
    fps,
    config: { damping: 22, stiffness: 130 },
  });
  const arrowLabelOpacity = interpolate(arrowLabelEntrance, [0, 1], [0, 1]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          backgroundColor: "rgba(255, 255, 255, 0.7)",
          backdropFilter: "blur(30px)",
          WebkitBackdropFilter: "blur(30px)",
          borderRadius: 20,
          border: "1px solid rgba(0, 0, 0, 0.06)",
          boxShadow:
            "0 0 0 0.5px rgba(0, 0, 0, 0.02), 0 4px 20px rgba(0, 0, 0, 0.06)",
          padding: "28px 32px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          transform: `scale(${entranceScale})`,
          boxSizing: "border-box",
        }}
      >
        {/* Server box */}
        <ContainerBox
          position="top"
          icon={<CloudIcon color={ORANGE} />}
          title="Pillar Server"
          label="Reasoning"
          accentColor={ORANGE}
          items={["Find related tools"]}
          frame={frame}
          fps={fps}
          activateFrame={SERVER_START}
          itemsStartFrame={SERVER_ITEMS_START}
        />

        {/* Vertical connection */}
        <div
          style={{
            width: "100%",
            height: 56,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            flexShrink: 0,
          }}
        >
          <svg
            width="40"
            height="56"
            style={{ position: "absolute", left: "50%", top: 0, transform: "translateX(-50%)" }}
          >
            <line
              x1="20"
              y1="4"
              x2="20"
              y2="44"
              stroke="rgba(0,0,0,0.1)"
              strokeWidth="1.5"
              strokeDasharray="5 5"
            />
            <polygon points="15,40 20,50 25,40" fill="rgba(0,0,0,0.1)" />
          </svg>

          {frame >= FLOW_START && (
            <div style={{ position: "absolute", left: "50%", top: 0, width: 0, height: 56 }}>
              <VerticalAnimatedDot frame={frame} delay={FLOW_START} startY={4} endY={44} x={0} />
              <VerticalAnimatedDot frame={frame} delay={FLOW_START + 15} startY={4} endY={44} x={0} />
            </div>
          )}

          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(16px, -50%)",
              opacity: arrowLabelOpacity,
            }}
          >
            <span
              style={{
                fontFamily: MONO_FONT,
                fontSize: 15,
                fontWeight: 500,
                color: "#86868B",
              }}
            >
              action plan
            </span>
          </div>
        </div>

        {/* Client box */}
        <ContainerBox
          position="bottom"
          icon={<BrowserIcon color={GREEN} />}
          title="User's Browser"
          label="Execution"
          accentColor={GREEN}
          items={["Navigate", "Submit form"]}
          frame={frame}
          fps={fps}
          activateFrame={CLIENT_START}
          itemsStartFrame={CLIENT_ITEMS_START}
        />

        {/* Security badges -- always visible */}
        <div
          style={{
            display: "flex",
            gap: 20,
            marginTop: 16,
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#86868B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span style={{ fontFamily: FONT, fontSize: 16, fontWeight: 400, color: "#86868B" }}>
              Existing session
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#86868B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span style={{ fontFamily: FONT, fontSize: 16, fontWeight: 400, color: "#86868B" }}>
              User permissions
            </span>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
