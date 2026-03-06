import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import {
  WIDTH,
  COLORS,
  FONT,
  MONO_FONT,
  CLICK_STEPS,
  PILLAR_PROMPT,
  SCENES,
} from "./constants";

// ---------------------------------------------------------------------------
// Load Inter font
// ---------------------------------------------------------------------------
if (typeof document !== "undefined") {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href =
    "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap";
  document.head.appendChild(link);
}

// ---------------------------------------------------------------------------
// Pillar Logo SVG
// ---------------------------------------------------------------------------
const PillarLogo = ({ size = 40 }: { size?: number }) => {
  const scale = size / 34;
  return (
    <svg
      width={34 * scale}
      height={34 * scale}
      viewBox="0 0 34 34"
      fill="none"
    >
      <circle cx="17" cy="17" r="17" fill={COLORS.accent} />
      <mask
        id="cg-pillar-mask"
        width="34"
        height="34"
        x="0"
        y="0"
        maskUnits="userSpaceOnUse"
        style={{ maskType: "alpha" } as React.CSSProperties}
      >
        <circle cx="17" cy="17" r="17" fill="white" />
      </mask>
      <g mask="url(#cg-pillar-mask)">
        <path
          fill="white"
          d="M9.55 40.56V12.07l6.681-1.77v28.686zM17.306 38.986V10.3l6.967-1.724V40.56z"
        />
      </g>
    </svg>
  );
};

// ---------------------------------------------------------------------------
// Animated dot grid background
// ---------------------------------------------------------------------------
const DotBackground = ({ frame }: { frame: number }) => {
  const shift = frame * 0.15;
  return (
    <svg
      width={WIDTH}
      height="1080"
      style={{ position: "absolute", top: 0, left: 0 }}
    >
      <defs>
        <pattern
          id="cg-dots"
          x={shift}
          y={shift}
          width="32"
          height="32"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="1" cy="1" r="0.6" fill="rgba(0,0,0,0.04)" />
        </pattern>
        <radialGradient id="cg-dot-fade" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="white" stopOpacity="0" />
          <stop offset="100%" stopColor="white" stopOpacity="0.6" />
        </radialGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#cg-dots)" />
      <rect width="100%" height="100%" fill="url(#cg-dot-fade)" />
    </svg>
  );
};

// ---------------------------------------------------------------------------
// Act 1: Trigger Builder wireframe (helpdesk admin UI)
// ---------------------------------------------------------------------------
const TriggerBuilderUI = ({
  frame,
  fps,
  currentClickIndex,
}: {
  frame: number;
  fps: number;
  currentClickIndex: number;
}) => {
  const entrance = spring({
    frame: Math.max(0, frame - SCENES.triggerUIIn),
    fps,
    config: { damping: 22, stiffness: 80 },
  });
  const uiOpacity = interpolate(entrance, [0, 1], [0, 1]);
  const uiY = interpolate(entrance, [0, 1], [30, 0]);

  // Fade out
  const fadeOut =
    frame >= SCENES.grindFadeOut
      ? interpolate(
          frame,
          [SCENES.grindFadeOut, SCENES.grindFadeOut + 15],
          [1, 0],
          { extrapolateRight: "clamp" }
        )
      : 1;

  const opacity = uiOpacity * fadeOut;
  if (opacity <= 0) return null;

  const sidebarItems = [
    "Dashboard",
    "Channels",
    "People",
    "Objects and rules",
    "   Triggers",
    "   Automations",
    "   SLA policies",
    "   Macros",
    "Workspaces",
    "Apps",
  ];

  const activeNav = currentClickIndex >= 1 ? 3 : -1;
  const showSubnav = currentClickIndex >= 2;

  // Conditions built so far
  const conditions: { field: string; op: string; value: string }[] = [];
  if (currentClickIndex >= 8)
    conditions.push({
      field: "Subject",
      op: "Contains",
      value: "billing",
    });
  if (currentClickIndex >= 12)
    conditions.push({
      field: "Subject",
      op: "Contains",
      value: "invoice",
    });
  if (currentClickIndex >= 16)
    conditions.push({
      field: "Subject",
      op: "Contains",
      value: "payment",
    });

  // Actions built so far
  const actions: { field: string; value: string }[] = [];
  if (currentClickIndex >= 19)
    actions.push({ field: "Priority", value: "High" });
  if (currentClickIndex >= 21)
    actions.push({ field: "Group", value: "Finance" });

  const showForm = currentClickIndex >= 3;
  const showName = currentClickIndex >= 4;

  // Active dropdown state
  const isDropdownOpen =
    currentClickIndex === 6 ||
    currentClickIndex === 7 ||
    currentClickIndex === 10 ||
    currentClickIndex === 11 ||
    currentClickIndex === 14 ||
    currentClickIndex === 15 ||
    currentClickIndex === 19 ||
    currentClickIndex === 21;

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: `translate(-50%, -50%) translateY(${uiY}px)`,
        opacity,
        width: 1100,
        height: 680,
        display: "flex",
        borderRadius: 16,
        overflow: "hidden",
        boxShadow:
          "0 4px 24px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)",
        border: `1px solid ${COLORS.border}`,
      }}
    >
      {/* Sidebar */}
      <div
        style={{
          width: 220,
          backgroundColor: "#1B1B2F",
          padding: "20px 0",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <div
          style={{
            padding: "8px 20px 20px",
            fontFamily: FONT,
            fontSize: 14,
            fontWeight: 700,
            color: "white",
            letterSpacing: "-0.02em",
          }}
        >
          Admin Center
        </div>
        {sidebarItems.map((item, i) => {
          const isActive =
            i === activeNav || (showSubnav && item.trim() === "Triggers");
          const isIndented = item.startsWith("   ");
          const show =
            !isIndented || (showSubnav && i >= 4 && i <= 7);
          if (!show) return null;
          return (
            <div
              key={i}
              style={{
                padding: `6px ${isIndented ? 36 : 20}px`,
                fontFamily: FONT,
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? "white" : "rgba(255,255,255,0.5)",
                backgroundColor: isActive
                  ? "rgba(255,255,255,0.1)"
                  : "transparent",
                borderLeft: isActive
                  ? `2px solid ${COLORS.accent}`
                  : "2px solid transparent",
              }}
            >
              {item.trim()}
            </div>
          );
        })}
      </div>

      {/* Main content */}
      <div
        style={{
          flex: 1,
          backgroundColor: COLORS.surface,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Top bar */}
        <div
          style={{
            padding: "14px 24px",
            borderBottom: `1px solid ${COLORS.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span
            style={{
              fontFamily: FONT,
              fontSize: 18,
              fontWeight: 700,
              color: COLORS.text,
            }}
          >
            {showForm ? "New Trigger" : "Triggers"}
          </span>
          {!showForm && (
            <div
              style={{
                padding: "6px 14px",
                backgroundColor: "#4F46E5",
                color: "white",
                borderRadius: 6,
                fontFamily: FONT,
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              + Add trigger
            </div>
          )}
        </div>

        {/* Form content */}
        {showForm && (
          <div
            style={{
              padding: 24,
              flex: 1,
              overflowY: "hidden",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            {/* Trigger name */}
            {showName && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span
                  style={{
                    fontFamily: FONT,
                    fontSize: 12,
                    fontWeight: 600,
                    color: COLORS.textMuted,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Trigger name
                </span>
                <div
                  style={{
                    padding: "8px 12px",
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 6,
                    fontFamily: FONT,
                    fontSize: 14,
                    color: COLORS.text,
                  }}
                >
                  Route billing tickets
                </div>
              </div>
            )}

            {/* Conditions */}
            {conditions.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <span
                  style={{
                    fontFamily: FONT,
                    fontSize: 12,
                    fontWeight: 600,
                    color: COLORS.textMuted,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Meet ALL of the following conditions
                </span>
                {conditions.map((c, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                    }}
                  >
                    <div
                      style={{
                        padding: "6px 10px",
                        backgroundColor: COLORS.dropdown,
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: 5,
                        fontFamily: FONT,
                        fontSize: 13,
                        color: COLORS.text,
                        minWidth: 120,
                      }}
                    >
                      {c.field} ▾
                    </div>
                    <div
                      style={{
                        padding: "6px 10px",
                        backgroundColor: COLORS.dropdown,
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: 5,
                        fontFamily: FONT,
                        fontSize: 13,
                        color: COLORS.text,
                        minWidth: 90,
                      }}
                    >
                      {c.op} ▾
                    </div>
                    <div
                      style={{
                        padding: "6px 10px",
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: 5,
                        fontFamily: FONT,
                        fontSize: 13,
                        color: COLORS.text,
                        flex: 1,
                      }}
                    >
                      {c.value}
                    </div>
                  </div>
                ))}
                <div
                  style={{
                    fontFamily: FONT,
                    fontSize: 13,
                    color: "#4F46E5",
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  + Add condition
                </div>
              </div>
            )}

            {/* Actions */}
            {actions.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <span
                  style={{
                    fontFamily: FONT,
                    fontSize: 12,
                    fontWeight: 600,
                    color: COLORS.textMuted,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Actions
                </span>
                {actions.map((a, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                    }}
                  >
                    <div
                      style={{
                        padding: "6px 10px",
                        backgroundColor: COLORS.dropdown,
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: 5,
                        fontFamily: FONT,
                        fontSize: 13,
                        color: COLORS.text,
                        minWidth: 120,
                      }}
                    >
                      {a.field} ▾
                    </div>
                    <div
                      style={{
                        padding: "6px 10px",
                        backgroundColor: COLORS.dropdown,
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: 5,
                        fontFamily: FONT,
                        fontSize: 13,
                        color: COLORS.text,
                        flex: 1,
                      }}
                    >
                      {a.value}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Active dropdown overlay */}
            {isDropdownOpen && (
              <div
                style={{
                  position: "absolute",
                  right: 80,
                  top: 200,
                  width: 200,
                  backgroundColor: COLORS.surface,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 8,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                  padding: "4px 0",
                }}
              >
                {["Option A", "Option B", "Option C", "Option D"].map(
                  (opt, i) => (
                    <div
                      key={i}
                      style={{
                        padding: "8px 14px",
                        fontFamily: FONT,
                        fontSize: 13,
                        color: i === 1 ? COLORS.accent : COLORS.text,
                        backgroundColor:
                          i === 1 ? `rgba(${COLORS.accentRgb}, 0.06)` : "transparent",
                      }}
                    >
                      {opt}
                    </div>
                  )
                )}
              </div>
            )}

            {/* Save button at bottom */}
            {currentClickIndex >= 22 && (
              <div style={{ marginTop: "auto", display: "flex", gap: 8 }}>
                <div
                  style={{
                    padding: "8px 20px",
                    backgroundColor: "#4F46E5",
                    color: "white",
                    borderRadius: 6,
                    fontFamily: FONT,
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  Save
                </div>
                <div
                  style={{
                    padding: "8px 20px",
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 6,
                    fontFamily: FONT,
                    fontSize: 14,
                    color: COLORS.textMuted,
                  }}
                >
                  Cancel
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty state before form */}
        {!showForm && (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: 8,
              padding: 24,
            }}
          >
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  padding: "12px 16px",
                  border: `1px solid ${COLORS.borderLight}`,
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    backgroundColor: COLORS.green,
                  }}
                />
                <div
                  style={{
                    width: 120 + i * 30,
                    height: 12,
                    backgroundColor: COLORS.borderLight,
                    borderRadius: 4,
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Click counter badge
// ---------------------------------------------------------------------------
const ClickCounter = ({
  frame,
  currentClick,
  totalClicks,
}: {
  frame: number;
  currentClick: number;
  totalClicks: number;
}) => {
  const visible = frame >= SCENES.clicksStart && frame < SCENES.grindFadeOut;
  if (!visible) return null;

  const fadeOut =
    frame >= SCENES.grindFadeOut - 15
      ? interpolate(
          frame,
          [SCENES.grindFadeOut - 15, SCENES.grindFadeOut],
          [1, 0],
          { extrapolateRight: "clamp" }
        )
      : 1;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 80,
        left: "50%",
        transform: "translateX(-50%)",
        opacity: fadeOut,
        display: "flex",
        alignItems: "center",
        gap: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 24px",
          backgroundColor: "rgba(239, 68, 68, 0.06)",
          border: "1px solid rgba(239, 68, 68, 0.15)",
          borderRadius: 40,
        }}
      >
        {/* Mouse cursor icon */}
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke={COLORS.red}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51z" />
          <path d="M13 13l6 6" />
        </svg>
        <span
          style={{
            fontFamily: MONO_FONT,
            fontSize: 20,
            fontWeight: 700,
            color: COLORS.red,
            letterSpacing: "-0.02em",
          }}
        >
          Click {Math.min(currentClick + 1, totalClicks)} of {totalClicks}
        </span>
      </div>
      <span
        style={{
          fontFamily: FONT,
          fontSize: 15,
          color: COLORS.textLight,
          fontStyle: "italic",
        }}
      >
        ...for just one trigger
      </span>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Transition text: "What if they could just say it?"
// ---------------------------------------------------------------------------
const TransitionQuestion = ({
  frame,
  fps,
}: {
  frame: number;
  fps: number;
}) => {
  const entrance = spring({
    frame: Math.max(0, frame - SCENES.questionIn),
    fps,
    config: { damping: 20, stiffness: 100 },
  });
  const exit =
    frame >= SCENES.questionOut
      ? spring({
          frame: frame - SCENES.questionOut,
          fps,
          config: { damping: 20, stiffness: 100 },
        })
      : 0;

  const opacity = interpolate(entrance, [0, 1], [0, 1]) * interpolate(exit, [0, 1], [1, 0]);
  const y = interpolate(entrance, [0, 1], [30, 0]);

  if (opacity <= 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: `translate(-50%, -50%) translateY(${y}px)`,
        opacity,
        textAlign: "center",
      }}
    >
      <span
        style={{
          fontFamily: FONT,
          fontSize: 52,
          fontWeight: 700,
          color: COLORS.text,
          letterSpacing: "-0.03em",
          lineHeight: 1.2,
        }}
      >
        What if they could
        <br />
        just{" "}
        <span
          style={{
            color: COLORS.accent,
            textDecoration: "underline",
            textUnderlineOffset: 6,
            textDecorationThickness: 3,
          }}
        >
          say it
        </span>
        ?
      </span>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Act 2: Pillar chat interface
// ---------------------------------------------------------------------------
const PillarChat = ({ frame, fps }: { frame: number; fps: number }) => {
  const entrance = spring({
    frame: Math.max(0, frame - SCENES.pillarIn),
    fps,
    config: { damping: 22, stiffness: 80 },
  });
  const chatOpacity = interpolate(entrance, [0, 1], [0, 1]);
  const chatScale = interpolate(entrance, [0, 1], [0.92, 1]);

  if (chatOpacity <= 0) return null;

  // Typing animation
  const typingFrame = Math.max(0, frame - SCENES.typingStart);
  const typingDuration = SCENES.typingEnd - SCENES.typingStart;
  const charsToShow = Math.min(
    PILLAR_PROMPT.length,
    Math.floor(
      interpolate(typingFrame, [0, typingDuration], [0, PILLAR_PROMPT.length], {
        extrapolateRight: "clamp",
      })
    )
  );
  const visibleText =
    frame >= SCENES.typingStart ? PILLAR_PROMPT.slice(0, charsToShow) : "";
  const cursorVisible =
    frame >= SCENES.typingStart &&
    (charsToShow < PILLAR_PROMPT.length ||
      Math.round(((frame - SCENES.typingEnd) / 8) % 2) === 0);

  // Steps animation
  const steps = [
    "Found 3 matching conditions",
    "Set priority → High",
    "Assigned group → Finance",
    "Trigger saved",
  ];

  const showDone = frame >= SCENES.doneAt;

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: `translate(-50%, -50%) scale(${chatScale})`,
        opacity: chatOpacity,
        width: 700,
      }}
    >
      {/* Chat container */}
      <div
        style={{
          backgroundColor: COLORS.surface,
          borderRadius: 20,
          border: `1px solid ${COLORS.border}`,
          boxShadow:
            "0 4px 24px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.03)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 24px",
            borderBottom: `1px solid ${COLORS.border}`,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <PillarLogo size={28} />
          <span
            style={{
              fontFamily: FONT,
              fontSize: 15,
              fontWeight: 600,
              color: COLORS.text,
            }}
          >
            Pillar
          </span>
        </div>

        {/* Input area */}
        <div style={{ padding: "24px" }}>
          <div
            style={{
              padding: "14px 18px",
              backgroundColor: COLORS.dropdown,
              borderRadius: 12,
              border: `1px solid ${COLORS.border}`,
              fontFamily: FONT,
              fontSize: 16,
              color: visibleText ? COLORS.text : COLORS.textLight,
              minHeight: 48,
              display: "flex",
              alignItems: "center",
            }}
          >
            <span>{visibleText || "Ask Pillar..."}</span>
            {cursorVisible && (
              <span
                style={{
                  width: 2,
                  height: 22,
                  backgroundColor: COLORS.accent,
                  borderRadius: 1,
                  marginLeft: 1,
                  display: "inline-block",
                }}
              />
            )}
          </div>
        </div>

        {/* Steps */}
        {frame >= SCENES.stepsStart && (
          <div
            style={{
              padding: "0 24px 24px",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {steps.map((step, i) => {
              const stepDelay = i * 6;
              const stepEntrance = spring({
                frame: Math.max(0, frame - SCENES.stepsStart - stepDelay),
                fps,
                config: { damping: 18, stiffness: 160 },
              });
              const stepOpacity = interpolate(
                stepEntrance,
                [0, 1],
                [0, 1]
              );
              const stepY = interpolate(stepEntrance, [0, 1], [8, 0]);

              return (
                <div
                  key={i}
                  style={{
                    opacity: stepOpacity,
                    transform: `translateY(${stepY}px)`,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 0",
                  }}
                >
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      backgroundColor: COLORS.greenLight,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={COLORS.green}
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </div>
                  <span
                    style={{
                      fontFamily: FONT,
                      fontSize: 15,
                      color: COLORS.text,
                      fontWeight: 500,
                    }}
                  >
                    {step}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* "Done" badge */}
      {showDone && (
        <div
          style={{
            marginTop: 20,
            display: "flex",
            justifyContent: "center",
            opacity: interpolate(
              spring({
                frame: Math.max(0, frame - SCENES.doneAt),
                fps,
                config: { damping: 18, stiffness: 120 },
              }),
              [0, 1],
              [0, 1]
            ),
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 24px",
              backgroundColor: "rgba(16, 185, 129, 0.06)",
              border: "1px solid rgba(16, 185, 129, 0.15)",
              borderRadius: 40,
            }}
          >
            <span
              style={{
                fontFamily: MONO_FONT,
                fontSize: 20,
                fontWeight: 700,
                color: COLORS.green,
              }}
            >
              1 sentence. 0 clicks.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Closing card
// ---------------------------------------------------------------------------
const ClosingCard = ({ frame, fps }: { frame: number; fps: number }) => {
  const entrance = spring({
    frame: Math.max(0, frame - SCENES.closingIn),
    fps,
    config: { damping: 22, stiffness: 80 },
  });
  const opacity = interpolate(entrance, [0, 1], [0, 1]);
  const y = interpolate(entrance, [0, 1], [20, 0]);

  if (opacity <= 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 48,
        left: "50%",
        transform: `translateX(-50%) translateY(${y}px)`,
        opacity,
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
      }}
    >
      <PillarLogo size={36} />
      <span
        style={{
          fontFamily: FONT,
          fontSize: 18,
          fontWeight: 500,
          color: COLORS.textMuted,
          letterSpacing: "-0.01em",
        }}
      >
        Your users know what they want. They don&apos;t know where to click.
      </span>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Act 1 title
// ---------------------------------------------------------------------------
const GrindTitle = ({ frame, fps }: { frame: number; fps: number }) => {
  const entrance = spring({
    frame: Math.max(0, frame - SCENES.titleIn),
    fps,
    config: { damping: 20, stiffness: 100 },
  });
  const fadeOut =
    frame >= SCENES.triggerUIIn
      ? interpolate(
          frame,
          [SCENES.triggerUIIn, SCENES.triggerUIIn + 15],
          [1, 0],
          { extrapolateRight: "clamp" }
        )
      : 1;

  const opacity = interpolate(entrance, [0, 1], [0, 1]) * fadeOut;
  if (opacity <= 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        opacity,
        textAlign: "center",
      }}
    >
      <span
        style={{
          fontFamily: FONT,
          fontSize: 18,
          fontWeight: 600,
          color: COLORS.textLight,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
        }}
      >
        The configuration grind
      </span>
      <div
        style={{
          fontFamily: FONT,
          fontSize: 48,
          fontWeight: 800,
          color: COLORS.text,
          letterSpacing: "-0.03em",
          marginTop: 8,
        }}
      >
        Setting up one trigger
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main Composition
// ---------------------------------------------------------------------------
export const ConfigGrindComposition = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Calculate current click index based on frame
  const clickProgress =
    frame >= SCENES.clicksStart
      ? interpolate(
          frame,
          [SCENES.clicksStart, SCENES.clicksEnd],
          [0, CLICK_STEPS.length - 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        )
      : -1;
  const currentClickIndex = Math.floor(clickProgress);

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      <DotBackground frame={frame} />

      {/* Act 1: Title */}
      <GrindTitle frame={frame} fps={fps} />

      {/* Act 1: Trigger builder UI */}
      <TriggerBuilderUI
        frame={frame}
        fps={fps}
        currentClickIndex={currentClickIndex}
      />

      {/* Click counter */}
      <ClickCounter
        frame={frame}
        currentClick={currentClickIndex}
        totalClicks={CLICK_STEPS.length}
      />

      {/* Transition */}
      <TransitionQuestion frame={frame} fps={fps} />

      {/* Act 2: Pillar chat */}
      <PillarChat frame={frame} fps={fps} />

      {/* Closing */}
      <ClosingCard frame={frame} fps={fps} />
    </AbsoluteFill>
  );
};
