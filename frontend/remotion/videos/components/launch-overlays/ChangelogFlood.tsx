import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import { FONT, MONO_FONT } from "./fonts";

type ChangelogItem = {
  version: string;
  date: string;
  title: string;
  tag: "feature" | "improvement" | "fix";
};

const TAG_COLORS = {
  feature: { bg: "#DBEAFE", text: "#1D4ED8" },
  improvement: { bg: "#E0E7FF", text: "#4338CA" },
  fix: { bg: "#FEF3C7", text: "#92400E" },
} as const;

const CHANGELOG_ITEMS: ChangelogItem[] = [
  { version: "2.41", date: "Feb 14", title: "Revamped onboarding flow", tag: "feature" },
  { version: "2.40", date: "Feb 12", title: "Bulk export for reports", tag: "feature" },
  { version: "2.39", date: "Feb 10", title: "Dashboard filter persistence", tag: "improvement" },
  { version: "2.38", date: "Feb 8", title: "Fixed timezone in analytics", tag: "fix" },
  { version: "2.37", date: "Feb 6", title: "Team permissions overhaul", tag: "feature" },
  { version: "2.36", date: "Feb 4", title: "API rate limit headers", tag: "improvement" },
  { version: "2.35", date: "Feb 2", title: "SSO for enterprise plans", tag: "feature" },
  { version: "2.34", date: "Jan 31", title: "Webhook retry logic", tag: "fix" },
  { version: "2.33", date: "Jan 29", title: "Custom email templates", tag: "feature" },
  { version: "2.32", date: "Jan 27", title: "Inline editing for tables", tag: "improvement" },
  { version: "2.31", date: "Jan 25", title: "Multi-currency support", tag: "feature" },
  { version: "2.30", date: "Jan 23", title: "Notification preferences", tag: "improvement" },
  { version: "2.29", date: "Jan 21", title: "Fixed CSV import parsing", tag: "fix" },
  { version: "2.28", date: "Jan 19", title: "Dark mode for dashboards", tag: "feature" },
  { version: "2.27", date: "Jan 17", title: "Audit log improvements", tag: "improvement" },
  { version: "2.26", date: "Jan 15", title: "Two-factor auth updates", tag: "fix" },
];

const CARD_PADDING = 48;
const ITEM_HEIGHT = 148;
const ITEM_GAP = 16;
const HEADER_HEIGHT = 130;
const VISIBLE_AREA = 800 - CARD_PADDING - HEADER_HEIGHT - 60;

export const CHANGELOG_DIMENSIONS = { width: 580, height: 800 };
export const CHANGELOG_DURATION = 165;

const ChangelogRow = ({
  item,
  opacity,
  y,
  blur,
}: {
  item: ChangelogItem;
  opacity: number;
  y: number;
  blur: number;
}) => {
  const tagColor = TAG_COLORS[item.tag];
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: "22px 28px",
        backgroundColor: "rgba(255, 255, 255, 0.8)",
        borderRadius: 14,
        border: "1px solid rgba(240, 237, 232, 0.6)",
        opacity,
        transform: `translateY(${y}px)`,
        filter: blur > 0 ? `blur(${blur}px)` : "none",
        height: ITEM_HEIGHT,
        boxSizing: "border-box",
        flexShrink: 0,
        justifyContent: "center",
      }}
    >
      {/* Line 1: version, date, tag */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <span
          style={{
            fontFamily: MONO_FONT,
            fontSize: 24,
            fontWeight: 600,
            color: "#6B7280",
            backgroundColor: "#F3F4F6",
            padding: "4px 12px",
            borderRadius: 8,
            flexShrink: 0,
            letterSpacing: "-0.02em",
          }}
        >
          v{item.version}
        </span>
        <span
          style={{
            fontFamily: FONT,
            fontSize: 24,
            color: "#9CA3AF",
            flexShrink: 0,
          }}
        >
          {item.date}
        </span>
        <span
          style={{
            fontFamily: FONT,
            fontSize: 20,
            fontWeight: 600,
            color: tagColor.text,
            backgroundColor: tagColor.bg,
            padding: "3px 12px",
            borderRadius: 6,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            flexShrink: 0,
          }}
        >
          {item.tag}
        </span>
      </div>
      {/* Line 2: full title */}
      <span
        style={{
          fontFamily: FONT,
          fontSize: 32,
          color: "#1F2937",
          fontWeight: 500,
          lineHeight: 1.2,
        }}
      >
        {item.title}
      </span>
    </div>
  );
};

export const ChangelogFlood = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cardEntrance = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 120 },
  });
  const cardScale = interpolate(cardEntrance, [0, 1], [0.99, 1]);

  const PHASE1_START = 10;
  const PHASE1_ITEM_INTERVAL = 10;
  const PHASE2_START = 55;
  const PHASE3_START = 130;

  const itemsTotalHeight = CHANGELOG_ITEMS.length * (ITEM_HEIGHT + ITEM_GAP);
  const maxScroll = Math.max(0, itemsTotalHeight - VISIBLE_AREA);

  let scrollOffset = 0;
  if (frame >= PHASE2_START) {
    const scrollProgress = interpolate(
      frame,
      [PHASE2_START, PHASE3_START],
      [0, 1],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );
    scrollOffset = maxScroll * Math.pow(scrollProgress, 1.5);
  }

  const badgeEntrance = spring({
    frame: Math.max(0, frame - PHASE3_START),
    fps,
    config: { damping: 14, stiffness: 180 },
  });
  const badgeScale = interpolate(badgeEntrance, [0, 1], [0.8, 1]);
  const badgeOpacity = interpolate(badgeEntrance, [0, 1], [0, 1]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "transparent",
      }}
    >
      <div
        style={{
          width: 700,
          height: 800,
          backgroundColor: "rgba(250, 250, 248, 0.85)",
          backdropFilter: "blur(12px)",
          border: "none",
          overflow: "hidden",
          transform: `scale(${cardScale})`,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: `28px ${CARD_PADDING}px`,
            borderBottom: "1px solid #E4E0D9",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: HEADER_HEIGHT,
            boxSizing: "border-box",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            <span
              style={{
                fontFamily: FONT,
                fontSize: 36,
                fontWeight: 600,
                color: "#1F2937",
                letterSpacing: "-0.02em",
              }}
            >
              v2.41 Changelog
            </span>
          </div>
          <div
            style={{
              fontFamily: FONT,
              fontSize: 26,
              color: "#9CA3AF",
              fontWeight: 500,
            }}
          >
            52 updates
          </div>
        </div>

        {/* Items list */}
        <div
          style={{
            flex: 1,
            padding: `10px ${CARD_PADDING}px`,
            overflow: "hidden",
            position: "relative",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: ITEM_GAP,
              transform: `translateY(${-scrollOffset}px)`,
            }}
          >
            {CHANGELOG_ITEMS.map((item, i) => {
              const itemAppearFrame = PHASE1_START + i * PHASE1_ITEM_INTERVAL;

              const effectiveAppearFrame =
                i < 4
                  ? itemAppearFrame
                  : PHASE2_START + (i - 4) * 4;

              const itemEntrance = spring({
                frame: Math.max(0, frame - effectiveAppearFrame),
                fps,
                config: { damping: 16, stiffness: 200 },
              });

              const itemOpacity = interpolate(itemEntrance, [0, 1], [0, 1]);
              const itemY = interpolate(itemEntrance, [0, 1], [20, 0]);

              if (frame < effectiveAppearFrame - 5) return null;

              return (
                <ChangelogRow
                  key={i}
                  item={item}
                  opacity={itemOpacity}
                  y={itemY}
                  blur={0}
                />
              );
            })}
          </div>

          {/* Bottom fade gradient */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 80,
              background:
                "linear-gradient(to bottom, transparent, rgba(250, 250, 248, 0.85))",
              pointerEvents: "none",
            }}
          />
        </div>

        {/* "+38 more" footer */}
        <div
          style={{
            padding: `12px ${CARD_PADDING}px 20px`,
            display: "flex",
            justifyContent: "center",
            opacity: badgeOpacity,
            transform: `scale(${badgeScale})`,
          }}
        >
          <div
            style={{
              fontFamily: FONT,
              fontSize: 30,
              fontWeight: 600,
              color: "#6B7280",
              backgroundColor: "#F3F4F6",
              padding: "14px 32px",
              borderRadius: 24,
              border: "1px solid #E5E7EB",
            }}
          >
            + 38 more this month
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
