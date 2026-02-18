import React from "react";
import { interpolate, spring } from "remotion";
import { BlinkingCursor } from "./BlinkingCursor";
import type { Step } from "./BankingDemoClassic";

/**
 * Small spinning loader for active progress steps.
 */
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

/**
 * SDK-style shimmer "Thinking..." indicator.
 * Replicates the _pillar-thinking-shimmer CSS class using Remotion frame-based animation.
 */
const ThinkingShimmer: React.FC<{ frame: number }> = ({ frame }) => {
  // Animate gradient position: 2-second cycle at 30fps = 60 frames
  const cyclePosition = (frame % 60) / 60; // 0→1 over 60 frames
  const bgPositionX = interpolate(cyclePosition, [0, 1], [100, -100]);

  return (
    <span
      style={{
        fontSize: 16,
        fontStyle: "italic",
        fontWeight: 500,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        background: `linear-gradient(90deg, #9CA3AF 0%, #D1D5DB 40%, #9CA3AF 60%)`,
        backgroundSize: "200% 100%",
        backgroundPositionX: `${bgPositionX}%`,
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        display: "inline-block",
        lineHeight: 1.5,
      }}
    >
      Thinking…
    </span>
  );
};

type CoPilotPanelProps = {
  frame: number;
  fps: number;
  query: string;
  responseText: string;
  steps: Step[];
  floatOffset: number;
  panelWidth: number;
  accentColor: string;
};

// Scene timing constants - aligned with Banking UI transitions
const TYPING_START = 60; // Start typing as zoom begins (Scene 2)
const TYPING_END = 180; // Typing finishes
const SEND_BUTTON_PRESS = 180; // When send button is pressed
const SPINNER_DURATION = 10; // 0.33s spinner animation
const MESSAGE_SENT = SEND_BUTTON_PRESS + SPINNER_DURATION; // Text morphs to bubble after spinner

// Step timing - slowed down for launch video (each step ~60 frames = 2s)
// Synced with: NAVIGATE_PAYMENT=360, PREFILL_DATA=400, MODAL_OPEN=530
const STEP_TIMING = [
  { start: 200, complete: 260 },  // Step 1: Looking up payees (API call)
  { start: 270, complete: 330 },  // Step 2: Found match: Sarah Chen
  { start: 340, complete: 390 },  // Step 3: Opening payment screen (synced with NAVIGATE_PAYMENT=360)
  { start: 400, complete: 460 },  // Step 4: Pre-filling with data (synced with PREFILL_DATA=400)
  { start: 470, complete: 520 },  // Step 5: Ready for confirmation
];

// Response timing - after all steps complete
const RESPONSE_START = 530;

export const CoPilotPanel = ({
  frame,
  fps,
  query,
  responseText,
  steps,
  floatOffset,
  panelWidth,
  accentColor,
}: CoPilotPanelProps) => {
  // Scene states
  const isScene2OrLater = frame >= 60;
  const isTyping = frame >= TYPING_START && frame < TYPING_END;
  const isSendPressed = frame >= SEND_BUTTON_PRESS;
  const isSpinning = frame >= SEND_BUTTON_PRESS && frame < MESSAGE_SENT;
  const isMessageSent = frame >= MESSAGE_SENT;
  const showResponse = frame >= RESPONSE_START;

  // Calculate how many characters to show
  const charsToShow = Math.floor(
    interpolate(frame - TYPING_START, [0, 75], [0, query.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
  );

  const displayText = isTyping
    ? query.slice(0, charsToShow)
    : isSendPressed
      ? query
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

  // Hide suggestions and empty state when zoomed in
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

  // Message bubble entrance
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

  // Input text display logic
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
              <span style={{ fontSize: 36 }}>🏦</span>
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
              accounts or transfers.
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
                    fontSize: 21,
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

            {/* SDK-style progress: shimmer thinking + grey italic steps */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              {/* Shimmer "Thinking..." — visible before first step appears */}
              {visibleStepCount === 0 && frame >= MESSAGE_SENT + 5 && (
                <ThinkingShimmer frame={frame} />
              )}

              {/* Progress steps — matches SDK ProgressRow style */}
              {steps.map((step, index) => {
                const visibility = getStepVisibility(index);
                if (visibility <= 0) return null;

                const status = getStepStatus(index);
                const isActive = status === "active";
                const isComplete = status === "complete";
                const displayText = isComplete ? step.completeText : step.activeText;

                return (
                  <div
                    key={index}
                    style={{
                      opacity: visibility,
                      transform: `translateY(${(1 - visibility) * 6}px)`,
                      padding: "3px 0",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    {isActive && <ActiveSpinner frame={frame} />}
                    {isComplete && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                        <circle cx="12" cy="12" r="10" fill="#22C55E" />
                        <polyline points="8,12 11,15 16,9" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                      </svg>
                    )}
                    <span
                      style={{
                        fontSize: 16,
                        fontStyle: "italic",
                        color: isActive ? "#6B7280" : "#9CA3AF",
                        fontWeight: isActive ? 500 : 400,
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                        display: "block",
                        lineHeight: 1.5,
                      }}
                    >
                      {displayText}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Response message — SDK-style assistant bubble */}
            {showResponse && (
              <div
                style={{
                  marginTop: 8,
                  opacity: responseOpacity,
                  transform: `translateY(${responseY}px)`,
                }}
              >
                <p
                  style={{
                    fontSize: 18,
                    color: "#374151",
                    margin: 0,
                    lineHeight: 1.6,
                    fontFamily:
                      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  }}
                >
                  {responseText}
                </p>
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
            "Pay my cleaner $200",
            "What's my checking balance?",
            "Show recent transactions",
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

      {/* Input Field - uses accent color for focus */}
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
            border: `${showInputFocus ? "2px" : "0.8px"} solid ${showInputFocus ? accentColor : "#E4E0D9"}`,
            padding: "18px 24px",
            gap: 18,
            boxShadow: showInputFocus
              ? `0 0 0 ${4 * focusGlowOpacity}px ${accentColor}26`
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
              backgroundColor: isSpinning ? "#22C55E" : accentColor,
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
