import { interpolate, spring } from "remotion";
import { SCENE_TIMING } from "./CameraController";

type ConfirmationModalProps = {
  frame: number;
  fps: number;
  entranceFrame: number;
  panelWidth: number;
};

const FONT =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

// 2FA code digits that appear one by one
const TWO_FA_CODE = ["4", "8", "2", "7", "1", "5"];

export const ConfirmationModal = ({
  frame,
  fps,
  entranceFrame,
  panelWidth,
}: ConfirmationModalProps) => {
  // Phase detection
  const isConfirmPhase = frame < SCENE_TIMING.CONFIRM_PRESS;
  const isTransitionTo2FA =
    frame >= SCENE_TIMING.CONFIRM_PRESS && frame < SCENE_TIMING.TWO_FA_SHOW;
  const is2FAPhase =
    frame >= SCENE_TIMING.TWO_FA_SHOW &&
    frame < SCENE_TIMING.TWO_FA_COMPLETE;
  const isSuccessPhase = frame >= SCENE_TIMING.TWO_FA_COMPLETE;

  // Modal entrance animation
  const entranceProgress = spring({
    frame: Math.max(0, frame - entranceFrame),
    fps,
    config: { damping: 20, stiffness: 200 },
  });

  const modalScale = interpolate(entranceProgress, [0, 1], [0.9, 1]);
  const modalOpacity = interpolate(entranceProgress, [0, 1], [0, 1]);
  const overlayOpacity = interpolate(entranceProgress, [0, 1], [0, 0.5]);

  // Confirm button pulse (only in confirm phase)
  const MODAL_VISIBLE = entranceFrame + 15;
  const pulseProgress = isConfirmPhase ? (frame - MODAL_VISIBLE) % 45 : 0;
  const glowRadius = interpolate(pulseProgress, [0, 45], [0, 12]);
  const glowOpacity = interpolate(pulseProgress, [0, 45], [0.4, 0]);

  // Cursor hover animation to confirm button
  const cursorProgress = spring({
    frame: Math.max(0, frame - (entranceFrame + 20)),
    fps,
    config: { damping: 30, stiffness: 80 },
  });
  const cursorX = isConfirmPhase
    ? interpolate(cursorProgress, [0, 1], [100, 0])
    : 0;
  const cursorY = isConfirmPhase
    ? interpolate(cursorProgress, [0, 1], [50, 0])
    : 0;

  // Confirm button press animation
  const confirmPressProgress = spring({
    frame: Math.max(0, frame - SCENE_TIMING.CONFIRM_PRESS),
    fps,
    config: { damping: 12, stiffness: 300 },
  });

  // 2FA content crossfade
  const twoFAFadeIn = spring({
    frame: Math.max(0, frame - SCENE_TIMING.TWO_FA_SHOW),
    fps,
    config: { damping: 20, stiffness: 150 },
  });

  // Calculate how many 2FA digits to show
  const digitInterval = 10; // frames between each digit
  const digitsElapsed = Math.max(
    0,
    frame - (SCENE_TIMING.TWO_FA_SHOW + 15)
  );
  const visibleDigits = Math.min(
    TWO_FA_CODE.length,
    Math.floor(digitsElapsed / digitInterval)
  );

  // Success animation
  const successProgress = spring({
    frame: Math.max(0, frame - SCENE_TIMING.TWO_FA_COMPLETE),
    fps,
    config: { damping: 15, stiffness: 150 },
  });

  // Calculate center position (accounting for panel on the right)
  const availableWidth = 1920 - panelWidth;
  const modalWidth = 440;
  const modalLeft = (availableWidth - modalWidth) / 2;

  // Content crossfade: confirm → 2FA → success
  const confirmContentOpacity =
    frame < SCENE_TIMING.CONFIRM_PRESS
      ? 1
      : interpolate(
          frame - SCENE_TIMING.CONFIRM_PRESS,
          [0, 15],
          [1, 0],
          { extrapolateRight: "clamp" }
        );

  const twoFAContentOpacity =
    frame < SCENE_TIMING.TWO_FA_SHOW
      ? 0
      : frame >= SCENE_TIMING.TWO_FA_COMPLETE
        ? interpolate(
            frame - SCENE_TIMING.TWO_FA_COMPLETE,
            [0, 15],
            [1, 0],
            { extrapolateRight: "clamp" }
          )
        : interpolate(twoFAFadeIn, [0, 1], [0, 1]);

  const successContentOpacity = interpolate(successProgress, [0, 1], [0, 1]);

  return (
    <>
      {/* Overlay */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: panelWidth,
          bottom: 0,
          backgroundColor: "#000000",
          opacity: overlayOpacity,
          zIndex: 60,
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: modalLeft + modalWidth / 2,
          transform: `translate(-50%, -50%) scale(${modalScale})`,
          opacity: modalOpacity,
          zIndex: 70,
          width: modalWidth,
        }}
      >
        <div
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 24,
            boxShadow: "0 25px 50px rgba(0, 0, 0, 0.25)",
            padding: "40px 48px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            position: "relative",
            overflow: "hidden",
            minHeight: 400,
          }}
        >
          {/* ====== Phase 1: Confirm Payment ====== */}
          <div
            style={{
              opacity: confirmContentOpacity,
              position: confirmContentOpacity < 1 ? "absolute" : "relative",
              top: confirmContentOpacity < 1 ? 40 : undefined,
              left: confirmContentOpacity < 1 ? 48 : undefined,
              right: confirmContentOpacity < 1 ? 48 : undefined,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              width: confirmContentOpacity < 1 ? "calc(100% - 96px)" : "100%",
            }}
          >
            <h2
              style={{
                fontSize: 28,
                fontWeight: 600,
                color: "#1A1A1A",
                margin: "0 0 32px 0",
                fontFamily: FONT,
              }}
            >
              Confirm Payment
            </h2>

            {/* Amount */}
            <div
              style={{
                backgroundColor: "#F8FAFC",
                borderRadius: 16,
                padding: "24px 48px",
                marginBottom: 32,
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: 56,
                  fontWeight: 700,
                  color: "#1A1A1A",
                  fontFamily: FONT,
                  letterSpacing: -2,
                }}
              >
                $200.00
              </div>
            </div>

            {/* Details */}
            <div
              style={{
                width: "100%",
                display: "flex",
                flexDirection: "column",
                gap: 16,
                marginBottom: 32,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                }}
              >
                <span style={{ fontSize: 16, color: "#64748B", fontFamily: FONT }}>
                  To
                </span>
                <div style={{ textAlign: "right" }}>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 500,
                      color: "#1A1A1A",
                      fontFamily: FONT,
                    }}
                  >
                    Sarah Chen
                  </div>
                  <div style={{ fontSize: 14, color: "#64748B", fontFamily: FONT }}>
                    Cleaner · Account ••••7823
                  </div>
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: 16, color: "#64748B", fontFamily: FONT }}>
                  From
                </span>
                <span
                  style={{
                    fontSize: 16,
                    fontWeight: 500,
                    color: "#1A1A1A",
                    fontFamily: FONT,
                  }}
                >
                  Checking ••••4892
                </span>
              </div>
            </div>

            <div
              style={{
                width: "100%",
                height: 1,
                backgroundColor: "#E2E8F0",
                marginBottom: 32,
              }}
            />

            {/* Confirm Button */}
            <div style={{ width: "100%", position: "relative" }}>
              <div
                style={{
                  backgroundColor:
                    confirmPressProgress > 0.1 ? "#16A34A" : "#22C55E",
                  borderRadius: 14,
                  padding: "18px 32px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  boxShadow: isConfirmPhase
                    ? `0 0 0 ${glowRadius}px rgba(34, 197, 94, ${glowOpacity})`
                    : "none",
                  transform:
                    confirmPressProgress > 0
                      ? `scale(${interpolate(confirmPressProgress, [0, 0.3, 1], [1, 0.95, 1])})`
                      : "scale(1)",
                }}
              >
                <span
                  style={{
                    fontSize: 20,
                    fontWeight: 600,
                    color: "#FFFFFF",
                    fontFamily: FONT,
                  }}
                >
                  Confirm
                </span>
                <span style={{ marginLeft: 8, fontSize: 18 }}>→</span>
              </div>

              {/* Cursor indicator */}
              {isConfirmPhase && (
                <div
                  style={{
                    position: "absolute",
                    bottom: -20,
                    right: 60 + cursorX,
                    transform: `translateY(${cursorY}px)`,
                    opacity: entranceProgress,
                    pointerEvents: "none",
                  }}
                >
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="#1A1A1A"
                    style={{
                      filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.2))",
                    }}
                  >
                    <path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87a.5.5 0 0 0 .35-.85L6.35 2.86a.5.5 0 0 0-.85.35z" />
                  </svg>
                </div>
              )}
            </div>

            <button
              style={{
                marginTop: 20,
                backgroundColor: "transparent",
                border: "none",
                fontSize: 16,
                color: "#64748B",
                cursor: "pointer",
                fontFamily: FONT,
              }}
            >
              Cancel
            </button>
          </div>

          {/* ====== Phase 2: Two-Factor Authentication ====== */}
          {frame >= SCENE_TIMING.CONFIRM_PRESS && (
            <div
              style={{
                opacity: twoFAContentOpacity,
                position:
                  twoFAContentOpacity < 1 && confirmContentOpacity > 0
                    ? "absolute"
                    : "relative",
                top:
                  twoFAContentOpacity < 1 && confirmContentOpacity > 0
                    ? 40
                    : undefined,
                left:
                  twoFAContentOpacity < 1 && confirmContentOpacity > 0
                    ? 48
                    : undefined,
                right:
                  twoFAContentOpacity < 1 && confirmContentOpacity > 0
                    ? 48
                    : undefined,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                width:
                  twoFAContentOpacity < 1 && confirmContentOpacity > 0
                    ? "calc(100% - 96px)"
                    : "100%",
              }}
            >
              {/* Lock icon */}
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 16,
                  backgroundColor: "#EFF6FF",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 24,
                }}
              >
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#3B82F6"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>

              <h2
                style={{
                  fontSize: 24,
                  fontWeight: 600,
                  color: "#1A1A1A",
                  margin: "0 0 8px 0",
                  fontFamily: FONT,
                }}
              >
                Two-Factor Authentication
              </h2>

              <p
                style={{
                  fontSize: 15,
                  color: "#64748B",
                  margin: "0 0 32px 0",
                  textAlign: "center",
                  fontFamily: FONT,
                }}
              >
                Enter the 6-digit code from your authenticator app
              </p>

              {/* Code input boxes */}
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  marginBottom: 32,
                }}
              >
                {TWO_FA_CODE.map((digit, i) => {
                  const isVisible = i < visibleDigits;
                  const isCurrentlyTyping = i === visibleDigits;

                  return (
                    <div
                      key={i}
                      style={{
                        width: 48,
                        height: 56,
                        borderRadius: 12,
                        border: `2px solid ${isCurrentlyTyping ? "#3B82F6" : isVisible ? "#22C55E" : "#E2E8F0"}`,
                        backgroundColor: isVisible ? "#F0FDF4" : "#FFFFFF",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "none",
                      }}
                    >
                      {isVisible && (
                        <span
                          style={{
                            fontSize: 28,
                            fontWeight: 700,
                            color: "#1A1A1A",
                            fontFamily: FONT,
                          }}
                        >
                          {digit}
                        </span>
                      )}
                      {isCurrentlyTyping && (
                        <div
                          style={{
                            width: 2,
                            height: 28,
                            backgroundColor:
                              Math.floor(frame / 15) % 2 === 0
                                ? "#3B82F6"
                                : "transparent",
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Verify button */}
              <div
                style={{
                  width: "100%",
                  backgroundColor:
                    visibleDigits >= TWO_FA_CODE.length
                      ? "#3B82F6"
                      : "#94A3B8",
                  borderRadius: 14,
                  padding: "16px 32px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: visibleDigits >= TWO_FA_CODE.length ? 1 : 0.5,
                }}
              >
                <span
                  style={{
                    fontSize: 18,
                    fontWeight: 600,
                    color: "#FFFFFF",
                    fontFamily: FONT,
                  }}
                >
                  Verify
                </span>
              </div>
            </div>
          )}

          {/* ====== Phase 3: Payment Success ====== */}
          {frame >= SCENE_TIMING.TWO_FA_COMPLETE && (
            <div
              style={{
                position: "absolute",
                top: 40,
                left: 48,
                right: 48,
                bottom: 40,
                opacity: successContentOpacity,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {/* Success checkmark circle */}
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: "50%",
                  backgroundColor: "#22C55E",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 24,
                  transform: `scale(${interpolate(successProgress, [0, 0.5, 1], [0.5, 1.15, 1])})`,
                }}
              >
                <svg
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>

              <h2
                style={{
                  fontSize: 28,
                  fontWeight: 600,
                  color: "#1A1A1A",
                  margin: "0 0 8px 0",
                  fontFamily: FONT,
                }}
              >
                Payment Sent
              </h2>

              <p
                style={{
                  fontSize: 16,
                  color: "#64748B",
                  margin: "0 0 8px 0",
                  fontFamily: FONT,
                }}
              >
                $200.00 to Sarah Chen
              </p>

              <p
                style={{
                  fontSize: 14,
                  color: "#94A3B8",
                  margin: 0,
                  fontFamily: FONT,
                }}
              >
                Transaction ID: TXN-482715
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
