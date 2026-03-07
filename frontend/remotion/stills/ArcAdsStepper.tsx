import React from "react";
import { AbsoluteFill } from "remotion";

const FONT =
  'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const MONO_FONT =
  '"SF Mono", "Fira Code", "Fira Mono", monospace';

if (typeof document !== "undefined") {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href =
    "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap";
  document.head.appendChild(link);
}

const C = {
  bg: "#FAFAFA",
  surface: "#FFFFFF",
  surfaceAlt: "#F5F5F7",
  border: "#E5E7EB",
  borderLight: "#F0F0F2",
  text: "#1A1A1A",
  textSecondary: "#6B7280",
  textMuted: "#9CA3AF",
  accent: "#7C3AED",
  accentLight: "#EDE9FE",
  accentBorder: "#C4B5FD",
  green: "#10B981",
  greenLight: "#D1FAE5",
  greenBorder: "#6EE7B7",
  pink: "#DB2777",
  pinkLight: "#FCE7F3",
  orange: "#F59E0B",
  orangeLight: "#FEF3C7",
} as const;

type StepStatus = "complete" | "active" | "locked";

interface StepDef {
  num: number;
  title: string;
  status: StepStatus;
}

const CheckIcon = ({ size = 14, color = C.green }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

const LockIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const PlayIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="white">
    <polygon points="5,3 19,12 5,21" />
  </svg>
);

const HorizontalStepConnector = ({ active }: { active: boolean }) => (
  <div style={{
    flex: 1,
    height: 2,
    backgroundColor: active ? C.green : C.border,
    borderRadius: 1,
    margin: "0 -4px",
    alignSelf: "center",
  }} />
);

const HorizontalStep = ({ step, isLast }: { step: StepDef; isLast: boolean }) => {
  const isComplete = step.status === "complete";
  const isActive = step.status === "active";
  const isLocked = step.status === "locked";

  return (
    <>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        cursor: isLocked ? "default" : "pointer",
        opacity: isLocked ? 0.5 : 1,
      }}>
        <div style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          backgroundColor: isComplete
            ? C.greenLight
            : isActive
              ? C.accentLight
              : C.surfaceAlt,
          border: isComplete
            ? `2px solid ${C.greenBorder}`
            : isActive
              ? `2px solid ${C.accentBorder}`
              : `2px solid ${C.border}`,
        }}>
          {isComplete ? (
            <CheckIcon size={14} color={C.green} />
          ) : isLocked ? (
            <LockIcon />
          ) : (
            <span style={{
              fontFamily: MONO_FONT,
              fontSize: 13,
              fontWeight: 600,
              color: isActive ? C.accent : C.textMuted,
            }}>
              {step.num}
            </span>
          )}
        </div>
        <span style={{
          fontFamily: FONT,
          fontSize: 14,
          fontWeight: isActive ? 600 : 500,
          color: isComplete
            ? C.textSecondary
            : isActive
              ? C.text
              : C.textMuted,
        }}>
          {step.title}
        </span>
      </div>
      {!isLast && (
        <HorizontalStepConnector active={isComplete} />
      )}
    </>
  );
};

const ActorCard = ({ name, selected, avatar, role }: { name: string; selected: boolean; avatar: string; role: string }) => (
  <div style={{
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 16px",
    borderRadius: 12,
    border: selected ? `2px solid ${C.accent}` : `1.5px solid ${C.border}`,
    backgroundColor: selected ? C.accentLight : C.surface,
    cursor: "pointer",
  }}>
    <div style={{
      width: 40,
      height: 40,
      borderRadius: "50%",
      backgroundColor: selected ? C.accentBorder : C.surfaceAlt,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 20,
    }}>
      {avatar}
    </div>
    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, color: C.text }}>{name}</span>
      <span style={{ fontFamily: FONT, fontSize: 11, color: C.textSecondary }}>{role}</span>
    </div>
    {selected && (
      <div style={{
        width: 22,
        height: 22,
        borderRadius: "50%",
        backgroundColor: C.accent,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <CheckIcon size={12} color="white" />
      </div>
    )}
  </div>
);

const ScriptEditor = () => {
  const lines = [
    { emotion: "curious", text: "So you want to add an AI copilot to your app. Great." },
    { emotion: "sighs", text: "You're gonna need a vector database. An embedding pipeline. An agent framework — LangChain, CrewAI, pick your poison. A streaming protocol. A frontend SDK." },
    { emotion: "sarcastic", text: "Oh, and guardrails so your bot doesn't go off the rails and tell a customer to eat glue." },
    { emotion: "pauses", text: "That's six months of engineering before you answer a single user question." },
    { emotion: "excited", text: "Pillar gives you the entire stack — knowledge base, reasoning engine, drop-in React components — out of the box. We had ours live in under a week." },
    { emotion: "firmly", text: "Link's below. Stop building plumbing." },
  ];

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      gap: 0,
      fontFamily: FONT,
      fontSize: 14,
      lineHeight: 1.65,
    }}>
      {lines.map((line, i) => (
        <div key={i} style={{
          display: "flex",
          gap: 12,
          padding: "5px 0",
        }}>
          <span style={{
            fontFamily: MONO_FONT,
            fontSize: 11,
            fontWeight: 500,
            color: C.pink,
            backgroundColor: C.pinkLight,
            padding: "2px 8px",
            borderRadius: 4,
            whiteSpace: "nowrap",
            alignSelf: "flex-start",
            marginTop: 3,
          }}>
            /{line.emotion}
          </span>
          <span style={{ color: C.text }}>{line.text}</span>
        </div>
      ))}
    </div>
  );
};

const AudioPreview = () => {
  const bars = [3, 5, 8, 12, 7, 10, 14, 9, 6, 11, 15, 8, 5, 9, 13, 7, 4, 10, 12, 6, 8, 11, 5, 7, 9, 13, 6, 10, 8, 4, 6, 9, 12, 7, 5, 8, 11, 14, 6, 9];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 44,
          height: 44,
          borderRadius: "50%",
          backgroundColor: C.surfaceAlt,
          border: `1.5px solid ${C.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 22,
        }}>
          🎭
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontFamily: FONT, fontSize: 15, fontWeight: 600, color: C.text }}>Charles</span>
          <span style={{ fontFamily: FONT, fontSize: 11, color: C.textSecondary }}>Generated audio · 0:42</span>
        </div>
      </div>

      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "14px 16px",
        borderRadius: 12,
        backgroundColor: C.surfaceAlt,
        border: `1px solid ${C.border}`,
      }}>
        <div style={{
          width: 34,
          height: 34,
          borderRadius: "50%",
          backgroundColor: C.accent,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}>
          <PlayIcon />
        </div>
        <div style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          gap: 2,
          height: 28,
        }}>
          {bars.map((h, i) => (
            <div key={i} style={{
              flex: 1,
              height: h * 1.4,
              borderRadius: 1.5,
              backgroundColor: i < 16 ? C.accent : C.border,
            }} />
          ))}
        </div>
        <span style={{
          fontFamily: MONO_FONT,
          fontSize: 11,
          color: C.textMuted,
          flexShrink: 0,
        }}>
          0:18 / 0:42
        </span>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <div style={{
          flex: 1,
          padding: "10px 0",
          borderRadius: 10,
          backgroundColor: C.green,
          color: "white",
          fontFamily: FONT,
          fontSize: 14,
          fontWeight: 600,
          textAlign: "center",
        }}>
          Approve Audio
        </div>
        <div style={{
          padding: "10px 20px",
          borderRadius: 10,
          backgroundColor: C.surface,
          border: `1.5px solid ${C.border}`,
          color: C.textSecondary,
          fontFamily: FONT,
          fontSize: 14,
          fontWeight: 500,
          textAlign: "center",
        }}>
          Regenerate
        </div>
      </div>
    </div>
  );
};

const STEPS: StepDef[] = [
  { num: 1, title: "Pick Actors", status: "complete" },
  { num: 2, title: "Write Script", status: "active" },
  { num: 3, title: "Verify Audio", status: "locked" },
];

const StepContent = ({ step }: { step: StepDef }) => {
  if (step.num === 1) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <ActorCard name="Charles" selected avatar="🎭" role="Professional · Male" />
        <ActorCard name="Sophia" selected={false} avatar="👩" role="Conversational · Female" />
        <ActorCard name="Marcus" selected={false} avatar="👨" role="Authoritative · Male" />
      </div>
    );
  }
  if (step.num === 2) {
    return <ScriptEditor />;
  }
  return <AudioPreview />;
};

export const ArcAdsStepper = () => {
  const activeStep = STEPS.find((s) => s.status === "active")!;

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, fontFamily: FONT }}>
      <div style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}>
        {/* Top bar with stepper */}
        <div style={{
          backgroundColor: C.surface,
          borderBottom: `1px solid ${C.border}`,
          padding: "0 40px",
        }}>
          {/* Header row */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 0 0",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{
                fontFamily: FONT,
                fontSize: 18,
                fontWeight: 700,
                color: C.text,
              }}>
                Talking Actors
              </span>
              <span style={{
                fontFamily: FONT,
                fontSize: 11,
                fontWeight: 600,
                color: C.accent,
                backgroundColor: C.accentLight,
                padding: "3px 8px",
                borderRadius: 6,
                letterSpacing: "0.02em",
              }}>
                NEW
              </span>
            </div>
            <span style={{
              fontFamily: FONT,
              fontSize: 12,
              color: C.textMuted,
            }}>
              Step {activeStep.num} of 3
            </span>
          </div>

          {/* Horizontal stepper */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: "20px 0",
          }}>
            {STEPS.map((step, i) => (
              <React.Fragment key={step.num}>
                <HorizontalStep step={step} isLast={i === STEPS.length - 1} />
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Content area */}
        <div style={{
          flex: 1,
          display: "flex",
          padding: "28px 40px",
          gap: 28,
          overflow: "hidden",
        }}>
          {/* Main content */}
          <div style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
          }}>
            <div style={{
              flex: 1,
              padding: "24px 28px",
              borderRadius: 16,
              backgroundColor: C.surface,
              border: `1px solid ${C.border}`,
              boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)",
              overflow: "auto",
            }}>
              <StepContent step={activeStep} />
            </div>

            {/* Footer bar */}
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              paddingTop: 16,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    backgroundColor: C.surfaceAlt,
                    border: `1px solid ${C.border}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 14,
                  }}>
                    🎭
                  </div>
                  <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 500, color: C.textSecondary }}>1 Actor</span>
                </div>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "4px 10px",
                  borderRadius: 8,
                  border: `1px solid ${C.border}`,
                  backgroundColor: C.surface,
                }}>
                  <span style={{ fontFamily: FONT, fontSize: 12, color: C.textSecondary }}>+ Add emotions</span>
                </div>
                <span style={{ fontFamily: FONT, fontSize: 12, color: C.textMuted }}>566 / 1,500</span>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <div style={{
                  padding: "8px 18px",
                  borderRadius: 10,
                  backgroundColor: C.surface,
                  border: `1.5px solid ${C.border}`,
                  fontFamily: FONT,
                  fontSize: 13,
                  fontWeight: 500,
                  color: C.textSecondary,
                }}>
                  Back
                </div>
                <div style={{
                  padding: "8px 22px",
                  borderRadius: 10,
                  backgroundColor: C.accent,
                  fontFamily: FONT,
                  fontSize: 13,
                  fontWeight: 600,
                  color: "white",
                }}>
                  Continue
                </div>
              </div>
            </div>
          </div>

          {/* Right sidebar: Actor Settings */}
          <div style={{
            width: 220,
            flexShrink: 0,
          }}>
            <div style={{
              padding: "18px 20px",
              borderRadius: 16,
              backgroundColor: C.surface,
              border: `1px solid ${C.border}`,
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}>
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16,
              }}>
                <span style={{
                  fontFamily: FONT,
                  fontSize: 14,
                  fontWeight: 600,
                  color: C.text,
                }}>
                  Actors Settings
                </span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {[
                  { label: "Model", value: "Arcads 1.0" },
                  { label: "Audio", value: "Text to Speech" },
                  { label: "Emotion", value: "Manually" },
                ].map(({ label, value }) => (
                  <div key={label} style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}>
                    <span style={{ fontFamily: FONT, fontSize: 13, color: C.textSecondary }}>{label}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ fontFamily: FONT, fontSize: 13, fontWeight: 500, color: C.text }}>{value}</span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
