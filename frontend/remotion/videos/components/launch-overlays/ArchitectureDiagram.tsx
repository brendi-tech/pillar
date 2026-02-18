import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";

const FONT =
  '"SF Pro Display", -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif';
const MONO_FONT =
  '"SF Mono", "Menlo", "Monaco", "Consolas", monospace';

const ORANGE = "#FF6E00";
const GREEN = "#34C759";

export const ARCHITECTURE_DIMENSIONS = { width: 700, height: 700 };
export const ARCHITECTURE_DURATION = 210;

const ENTRANCE_END = 20;
const SERVER_START = 25;
const SERVER_ITEMS_START = 38;
const FLOW_START = 88;
const CLIENT_START = 108;
const CLIENT_ITEMS_START = 118;
const BADGES_START = 158;

const CloudIcon = ({ color }: { color: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
  </svg>
);

const BrowserIcon = ({ color }: { color: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
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
        left: x - 3,
        top: y,
        width: 6,
        height: 6,
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

  const borderOpacity = interpolate(activateProgress, [0, 1], [0, 1]);

  return (
    <div
      style={{
        width: "100%",
        backgroundColor: "rgba(255, 255, 255, 0.6)",
        borderRadius: 16,
        border: `1.5px solid`,
        borderColor: `rgba(${accentColor === ORANGE ? "255,110,0" : "52,199,89"}, ${borderOpacity * 0.35 + 0.08})`,
        padding: "20px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            backgroundColor: `rgba(${accentColor === ORANGE ? "255,110,0" : "52,199,89"}, 0.08)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {icon}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <span
            style={{
              fontFamily: FONT,
              fontSize: 17,
              fontWeight: 600,
              color: "#1D1D1F",
              letterSpacing: "-0.01em",
            }}
          >
            {title}
          </span>
          <span
            style={{
              fontFamily: FONT,
              fontSize: 12,
              fontWeight: 500,
              color: accentColor,
              letterSpacing: "0.01em",
            }}
          >
            {label}
          </span>
        </div>
      </div>

      {/* Items row */}
      <div style={{ display: "flex", gap: 6 }}>
        {items.map((text, i) => {
          const itemFrame = itemsStartFrame + i * 10;
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
                gap: 7,
                padding: "8px 12px",
                backgroundColor: `rgba(${accentColor === ORANGE ? "255,110,0" : "52,199,89"}, 0.05)`,
                borderRadius: 8,
                opacity: itemOpacity,
                transform: `translateY(${itemY}px)`,
                flex: 1,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
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
                  fontSize: 13,
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
  const entranceOpacity = interpolate(entrance, [0, 1], [0, 1]);
  const entranceScale = interpolate(entrance, [0, 1], [0.97, 1]);

  const flowLineOpacity = interpolate(
    frame,
    [ENTRANCE_END, ENTRANCE_END + 12],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const arrowLabelEntrance = spring({
    frame: Math.max(0, frame - FLOW_START),
    fps,
    config: { damping: 22, stiffness: 130 },
  });
  const arrowLabelOpacity = interpolate(arrowLabelEntrance, [0, 1], [0, 1]);

  const badgeEntrance = spring({
    frame: Math.max(0, frame - BADGES_START),
    fps,
    config: { damping: 18, stiffness: 150 },
  });
  const badgeOpacity = interpolate(badgeEntrance, [0, 1], [0, 1]);
  const badgeY = interpolate(badgeEntrance, [0, 1], [6, 0]);

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
          width: 620,
          backgroundColor: "rgba(255, 255, 255, 0.7)",
          backdropFilter: "blur(30px)",
          WebkitBackdropFilter: "blur(30px)",
          borderRadius: 20,
          border: "1px solid rgba(0, 0, 0, 0.06)",
          boxShadow:
            "0 0 0 0.5px rgba(0, 0, 0, 0.02), 0 4px 20px rgba(0, 0, 0, 0.06)",
          padding: "32px 36px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          transform: `scale(${entranceScale})`,
          opacity: entranceOpacity,
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
          items={["Understands intent", "Builds plan", "Selects actions"]}
          frame={frame}
          fps={fps}
          activateFrame={SERVER_START}
          itemsStartFrame={SERVER_ITEMS_START}
        />

        {/* Vertical connection */}
        <div
          style={{
            width: "100%",
            height: 72,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            opacity: flowLineOpacity,
            flexShrink: 0,
          }}
        >
          <svg
            width="40"
            height="72"
            style={{ position: "absolute", left: "50%", top: 0, transform: "translateX(-50%)" }}
          >
            <line
              x1="20"
              y1="4"
              x2="20"
              y2="60"
              stroke="rgba(0,0,0,0.1)"
              strokeWidth="1.5"
              strokeDasharray="5 5"
            />
            <polygon points="15,56 20,66 25,56" fill="rgba(0,0,0,0.1)" />
          </svg>

          {frame >= FLOW_START && (
            <div style={{ position: "absolute", left: "50%", top: 0, width: 0, height: 72 }}>
              <VerticalAnimatedDot frame={frame} delay={FLOW_START} startY={4} endY={60} x={0} />
              <VerticalAnimatedDot frame={frame} delay={FLOW_START + 15} startY={4} endY={60} x={0} />
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
                fontSize: 10,
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
          items={["Clicks buttons", "Fills forms", "Navigates pages"]}
          frame={frame}
          fps={fps}
          activateFrame={CLIENT_START}
          itemsStartFrame={CLIENT_ITEMS_START}
        />

        {/* Security badges */}
        <div
          style={{
            display: "flex",
            gap: 16,
            marginTop: 20,
            opacity: badgeOpacity,
            transform: `translateY(${badgeY}px)`,
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#86868B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 400, color: "#86868B" }}>
              Existing session
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#86868B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 400, color: "#86868B" }}>
              User permissions
            </span>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
