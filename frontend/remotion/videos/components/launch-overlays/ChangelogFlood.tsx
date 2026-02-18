import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";

const FONT =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
const MONO_FONT = "SF Mono, Monaco, Menlo, Consolas, monospace";

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

const CARD_PADDING = 32;
const ITEM_HEIGHT = 56;
const ITEM_GAP = 8;
const HEADER_HEIGHT = 72;
const VISIBLE_AREA = 800 - CARD_PADDING * 2 - HEADER_HEIGHT - 60;

export const CHANGELOG_DIMENSIONS = { width: 700, height: 800 };
export const CHANGELOG_DURATION = 165; // 5.5 seconds

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
        alignItems: "center",
        gap: 14,
        padding: "12px 16px",
              backgroundColor: "rgba(255, 255, 255, 0.8)",
              borderRadius: 10,
              border: "1px solid rgba(240, 237, 232, 0.6)",
        opacity,
        transform: `translateY(${y}px)`,
        filter: blur > 0 ? `blur(${blur}px)` : "none",
        height: ITEM_HEIGHT,
        boxSizing: "border-box",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          fontFamily: MONO_FONT,
          fontSize: 13,
          fontWeight: 600,
          color: "#6B7280",
          backgroundColor: "#F3F4F6",
          padding: "3px 8px",
          borderRadius: 5,
          flexShrink: 0,
          letterSpacing: "-0.02em",
        }}
      >
        v{item.version}
      </span>
      <span
        style={{
          fontFamily: FONT,
          fontSize: 14,
          color: "#9CA3AF",
          flexShrink: 0,
          width: 48,
        }}
      >
        {item.date}
      </span>
      <span
        style={{
          fontFamily: FONT,
          fontSize: 15,
          color: "#1F2937",
          fontWeight: 500,
          flex: 1,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {item.title}
      </span>
      <span
        style={{
          fontFamily: FONT,
          fontSize: 11,
          fontWeight: 600,
          color: tagColor.text,
          backgroundColor: tagColor.bg,
          padding: "2px 8px",
          borderRadius: 4,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          flexShrink: 0,
        }}
      >
        {item.tag}
      </span>
    </div>
  );
};

export const ChangelogFlood = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Card entrance
  const cardEntrance = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 120 },
  });
  const cardScale = interpolate(cardEntrance, [0, 1], [0.99, 1]);

  // Phase 1 (frames 10-80): Items appear one by one at readable pace
  // Phase 2 (frames 80-130): Items scroll fast, blur increases
  // Phase 3 (frames 130-165): "+38 more" counter appears, hold

  const PHASE1_START = 10;
  const PHASE1_ITEM_INTERVAL = 10;
  const PHASE2_START = 80;
  const PHASE3_START = 130;

  // Calculate scroll offset — starts scrolling once items exceed visible area
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
    // Ease-in scroll that accelerates
    scrollOffset = maxScroll * Math.pow(scrollProgress, 1.5);
  }

  // "+38 more" badge
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
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          width: 700 - 40,
          height: 800 - 40,
          backgroundColor: "rgba(250, 250, 248, 0.85)",
          backdropFilter: "blur(12px)",
          borderRadius: 16,
          border: "1px solid rgba(228, 224, 217, 0.6)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)",
          overflow: "hidden",
          transform: `scale(${cardScale})`,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: `20px ${CARD_PADDING}px`,
            borderBottom: "1px solid #E4E0D9",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: HEADER_HEIGHT,
            boxSizing: "border-box",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            <span
              style={{
                fontFamily: FONT,
                fontSize: 17,
                fontWeight: 600,
                color: "#1F2937",
              }}
            >
              Changelog
            </span>
          </div>
          <span
            style={{
              fontFamily: FONT,
              fontSize: 13,
              color: "#9CA3AF",
              fontWeight: 500,
            }}
          >
            Last 30 days
          </span>
        </div>

        {/* Items list */}
        <div
          style={{
            flex: 1,
            padding: `16px ${CARD_PADDING}px`,
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
              // Phase 1: staggered spring entrance
              const itemAppearFrame = PHASE1_START + i * PHASE1_ITEM_INTERVAL;

              // Accelerate appearance in phase 2
              const effectiveAppearFrame =
                i < 7
                  ? itemAppearFrame
                  : PHASE2_START + (i - 7) * 4;

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
              fontSize: 15,
              fontWeight: 600,
              color: "#6B7280",
              backgroundColor: "#F3F4F6",
              padding: "8px 20px",
              borderRadius: 20,
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
