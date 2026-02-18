import { interpolate, spring } from "remotion";
import { BlinkingCursor } from "./BlinkingCursor";
import type { Step } from "../Root";

type CoPilotPanelProps = {
  frame: number;
  fps: number;
  query: string;
  responseText: string;
  steps: Step[];
  floatOffset: number;
  panelWidth: number;
};

// Scene timing constants - aligned with HR UI transitions
const TYPING_START = 60; // Start typing when zoom begins
const TYPING_END = 165; // Typing finishes, then send
const SEND_BUTTON_PRESS = 165; // When send button is pressed
const SPINNER_DURATION = 10; // 0.33s spinner animation
const MESSAGE_SENT = SEND_BUTTON_PRESS + SPINNER_DURATION; // Text morphs to bubble after spinner

// Step timing - synced with HR UI changes (3 steps with activeText/completeText)
const STEP_TIMING = [
  { start: 189, complete: 245 },  // Step 1: Navigating → Opened Payroll settings
  { start: 255, complete: 305 },  // Step 2: Finding → Found Direct Deposit
  { start: 315, complete: 360 },  // Step 3: Opening form → Ready for bank details
];

// Response timing
const RESPONSE_START = 360;

// HR-specific colors
const ACCENT_COLOR = "#8B5CF6"; // Purple for HR
const SUCCESS_COLOR = "#22C55E"; // Green for completed

const ActiveSpinner: React.FC<{ frame: number }> = ({ frame }) => {
  const rotation = (frame % 30) * 12;
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      style={{ flexShrink: 0, transform: `rotate(${rotation}deg)` }}
    >
      <circle cx="12" cy="12" r="10" stroke="#E5E7EB" strokeWidth="2.5" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="#6B7280" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
};

export const CoPilotPanel = ({
  frame,
  fps,
  query,
  responseText,
  steps,
  floatOffset,
  panelWidth,
}: CoPilotPanelProps) => {
  // Scene states
  const isScene2OrLater = frame >= 60;
  const isTyping = frame >= TYPING_START && frame < TYPING_END;
  const isSendPressed = frame >= SEND_BUTTON_PRESS;
  const isSpinning = frame >= SEND_BUTTON_PRESS && frame < MESSAGE_SENT;
  const isMessageSent = frame >= MESSAGE_SENT;
  const showResponse = frame >= RESPONSE_START;

  // Calculate how many characters to show (shorter query = fewer frames needed)
  const charsToShow = Math.floor(
    interpolate(frame - TYPING_START, [0, 80], [0, query.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
  );

  const displayText = isTyping
    ? query.slice(0, charsToShow)
    : isSendPressed
      ? query // Keep full text visible during send animation
      : "";

  // Focus glow on input field during Scene 2-3
  const focusGlowOpacity = interpolate(
    spring({
      frame: Math.max(0, frame - 60),
      fps,
      config: { damping: 200 },
    }),
    [0, 1],
    [0, 1]
  );

  // Hide suggestions and empty state when zoomed in (Scene 2+)
  const suggestionsOpacity = interpolate(frame, [60, 75], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const emptyStateOpacity = interpolate(frame, [60, 75], [0.6, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Spinner rotation for send button
  const spinnerRotation = isSpinning
    ? interpolate(frame - SEND_BUTTON_PRESS, [0, SPINNER_DURATION], [0, 360 * 2])
    : 0;

  // Message bubble entrance - morphs from input to bubble position
  const messageBubbleProgress = spring({
    frame: Math.max(0, frame - MESSAGE_SENT),
    fps,
    config: { damping: 15, stiffness: 200 },
  });

  const messageBubbleY = interpolate(messageBubbleProgress, [0, 1], [50, 0]);
  const messageBubbleOpacity = interpolate(messageBubbleProgress, [0, 1], [0, 1]);

  // Input text fades out as bubble appears
  const inputTextOpacity = isMessageSent
    ? interpolate(messageBubbleProgress, [0, 0.5], [1, 0], { extrapolateRight: "clamp" })
    : 1;

  // Step visibility and status
  const getStepVisibility = (stepIndex: number) => {
    const timing = STEP_TIMING[stepIndex];
    if (!timing) return 0;

    return interpolate(frame - timing.start, [0, 10], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  };

  const getStepStatus = (stepIndex: number): "complete" | "active" | "pending" => {
    const timing = STEP_TIMING[stepIndex];
    if (!timing) return "pending";

    if (frame < timing.start) return "pending";
    if (frame >= timing.complete) return "complete";
    return "active";
  };

  // Response entrance
  const responseProgress = spring({
    frame: Math.max(0, frame - RESPONSE_START),
    fps,
    config: { damping: 200 },
  });

  const responseOpacity = interpolate(responseProgress, [0, 1], [0, 1]);
  const responseY = interpolate(responseProgress, [0, 1], [15, 0]);

  // Count visible steps
  const visibleStepCount = steps.filter((_, i) => getStepVisibility(i) > 0).length;

  // Input text stays visible during spinner, then fades as bubble appears
  const inputDisplayText = isSendPressed && messageBubbleProgress > 0.5 ? "" : displayText;
  const showPlaceholder = !isScene2OrLater || (isMessageSent && messageBubbleProgress > 0.5);
  const showInputFocus = isScene2OrLater && !isMessageSent;

  return (
    <div
      style={{
        position: "absolute",
        right: 0,
        top: 0,
        bottom: 0,
        width: panelWidth,
        backgroundColor: "#FFFFFF",
        borderLeft: "0.8px solid #E4E0D9",
        display: "flex",
        flexDirection: "column",
        boxShadow: "-12px 0 40px rgba(0, 0, 0, 0.15)",
        transform: `translateY(${floatOffset * 0.4}px)`,
        zIndex: 50,
      }}
    >
      {/* Panel Header */}
      <div
        style={{
          height: 56,
          padding: "0 20px",
          borderBottom: "0.8px solid #E4E0D9",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          {/* Pillar Logo - icon only */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="28"
            height="28"
            fill="none"
            viewBox="0 0 34 34"
          >
            <mask
              id="pillar-icon-mask"
              width="34"
              height="34"
              x="0"
              y="0"
              maskUnits="userSpaceOnUse"
              style={{ maskType: "alpha" } as React.CSSProperties}
            >
              <circle cx="16.912" cy="16.912" r="16.912" fill="#1A1A1A"></circle>
            </mask>
            <g mask="url(#pillar-icon-mask)">
              <circle
                cx="16.912"
                cy="16.912"
                r="16.405"
                stroke="#1A1A1A"
                strokeWidth="1.012"
              ></circle>
              <path
                fill="#1A1A1A"
                d="M9.55 40.56V12.07l6.681-1.77v28.686zM17.306 38.986V10.3l6.967-1.724V40.56z"
              ></path>
            </g>
          </svg>
        </div>

        {/* Close button */}
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            backgroundColor: "#F5F5F5",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <span style={{ color: "#666666", fontSize: 14, lineHeight: 1 }}>
            ✕
          </span>
        </div>
      </div>

      {/* Chat Area */}
      <div
        style={{
          flex: 1,
          padding: 30,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Empty state - fades out during Scene 2 */}
        {!isMessageSent && (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              opacity: emptyStateOpacity,
            }}
          >
            <div
              style={{
                width: 75,
                height: 75,
                margin: "0 auto 21px",
                backgroundColor: "#F1F5F9",
                borderRadius: 18,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span style={{ fontSize: 36 }}>💬</span>
            </div>
            <p
              style={{
                fontSize: 18,
                color: "#666666",
                margin: 0,
                textAlign: "center",
                fontFamily:
                  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              }}
            >
              Ask me anything about your
              <br />
              HR settings or benefits.
            </p>
          </div>
        )}

        {/* Chat messages area - shows after message is sent */}
        {isMessageSent && (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: 21,
            }}
          >
            {/* User message bubble */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                opacity: messageBubbleOpacity,
                transform: `translateY(${messageBubbleY}px)`,
              }}
            >
              <div
                style={{
                  backgroundColor: "#F3EFE8",
                  borderRadius: 18,
                  borderBottomRightRadius: 6,
                  padding: "18px 24px",
                  maxWidth: "85%",
                }}
              >
                <p
                  style={{
                    fontSize: 20,
                    color: "#1A1A1A",
                    margin: 0,
                    fontFamily:
                      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  }}
                >
                  {query}
                </p>
              </div>
            </div>

            {/* Steps indicator area - Technical flow */}
            {visibleStepCount > 0 && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  paddingLeft: 6,
                }}
              >
                {steps.map((step, index) => {
                  const visibility = getStepVisibility(index);
                  const status = getStepStatus(index);

                  if (visibility <= 0) return null;

                  const isComplete = status === "complete";
                  const isActive = status === "active";
                  const stepDisplayText = isComplete ? step.completeText : step.activeText;

                  return (
                    <div
                      key={index}
                      style={{
                        opacity: visibility,
                        transform: `translateY(${(1 - visibility) * 9}px)`,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        {isActive && <ActiveSpinner frame={frame} />}
                        {isComplete && (
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            style={{ flexShrink: 0 }}
                          >
                            <circle cx="12" cy="12" r="12" fill="#22C55E" />
                            <path
                              d="M7 13l3 3 7-7"
                              stroke="#fff"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                        <span
                          style={{
                            fontSize: 20,
                            color: isComplete ? "#374151" : "#6B7280",
                            fontStyle: "italic",
                            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                          }}
                        >
                          {stepDisplayText}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Response message */}
            {showResponse && (
              <div
                style={{
                  marginTop: 12,
                  opacity: responseOpacity,
                  transform: `translateY(${responseY}px)`,
                }}
              >
                <div
                  style={{
                    backgroundColor: "#FFFFFF",
                    border: `2px solid ${SUCCESS_COLOR}`,
                    borderRadius: 18,
                    borderBottomLeftRadius: 6,
                    padding: "18px 24px",
                  }}
                >
                  <p
                    style={{
                      fontSize: 20,
                      color: "#1A1A1A",
                      margin: 0,
                      fontFamily:
                        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    }}
                  >
                    ✓ {responseText}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Suggested Actions - fades out during Scene 2 */}
      {!isMessageSent && (
        <div
          style={{
            padding: "0 30px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            opacity: suggestionsOpacity,
          }}
        >
          <span
            style={{
              fontSize: 15,
              fontWeight: 500,
              color: "#999999",
              textTransform: "uppercase",
              letterSpacing: "0.75px",
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            }}
          >
            Try asking
          </span>
          {[
            "How do I update my direct deposit?",
            "What's my PTO balance?",
            "Show my tax documents",
          ].map((suggestion, i) => (
            <div
              key={i}
              style={{
                padding: "15px 21px",
                backgroundColor: "#F8F7F5",
                borderRadius: 9,
                border: "0.8px solid #E4E0D9",
                fontSize: 18,
                color: "#666666",
                cursor: "pointer",
                fontFamily:
                  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              }}
            >
              {suggestion}
            </div>
          ))}
        </div>
      )}

      {/* Input Field */}
      <div
        style={{
          padding: "24px 30px 36px 30px",
          borderTop: "0.8px solid #E4E0D9",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            backgroundColor: showInputFocus ? "#FFFFFF" : "#F8F7F5",
            borderRadius: 15,
            border: `${showInputFocus ? "2px" : "0.8px"} solid ${showInputFocus ? ACCENT_COLOR : "#E4E0D9"}`,
            padding: "18px 24px",
            gap: 18,
            boxShadow: showInputFocus
              ? `0 0 0 ${4 * focusGlowOpacity}px rgba(139, 92, 246, ${0.15 * focusGlowOpacity})`
              : "none",
          }}
        >
          <div
            style={{
              flex: 1,
              fontSize: 21,
              color: inputDisplayText ? "#1A1A1A" : "#999999",
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              minHeight: 30,
              opacity: inputTextOpacity,
              lineHeight: 1.4,
            }}
          >
            <span style={{ display: "inline" }}>
              {inputDisplayText || (showPlaceholder ? "Ask a question..." : "")}
              {showInputFocus && !isSpinning && (
                <BlinkingCursor frame={frame} startFrame={60} visible={true} />
              )}
            </span>
          </div>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              backgroundColor: isSpinning ? SUCCESS_COLOR : ACCENT_COLOR,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: isSpinning ? `scale(1.05)` : "scale(1)",
            }}
          >
            {isSpinning ? (
              // Spinner icon
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#FFFFFF"
                strokeWidth="2.5"
                strokeLinecap="round"
                style={{
                  transform: `rotate(${spinnerRotation}deg)`,
                }}
              >
                <circle cx="12" cy="12" r="10" strokeOpacity="0.3" />
                <path d="M12 2a10 10 0 0 1 10 10" />
              </svg>
            ) : (
              // Send icon
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#FFFFFF"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
