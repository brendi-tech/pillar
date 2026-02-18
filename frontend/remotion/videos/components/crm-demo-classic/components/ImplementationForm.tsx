import { interpolate, spring } from "remotion";

type ImplementationFormProps = {
  frame: number;
  fps: number;
  visible: boolean;
  entranceFrame: number;
  panelWidth: number;
};

// Timing for form field population and submission
const FIELD_START = 381; // When fields start populating
const FIELD_INTERVAL = 12; // Frames between each field
// Fields finish around: 275 + 1*12 + 25 = 312
// Add ~63 frames (2.1 seconds) pause to let user read the filled form
const BUTTON_CLICK_FRAME = 503; // When button gets "clicked"
const FORM_EXIT_START = 9999; // Never trigger exit animation - form fades with UI

export const ImplementationForm = ({
  frame,
  fps,
  visible,
  entranceFrame,
  panelWidth,
}: ImplementationFormProps) => {
  // Modal entrance animation
  const springFrame = Math.max(0, frame - entranceFrame);
  const entranceProgress = spring({
    frame: springFrame,
    fps,
    config: { damping: 20, stiffness: 200 },
  });

  // Modal exit animation
  const exitProgress = spring({
    frame: Math.max(0, frame - FORM_EXIT_START),
    fps,
    config: { damping: 15, stiffness: 300 },
  });

  // Combine entrance and exit for final values
  const isExiting = frame >= FORM_EXIT_START;
  const scale = isExiting
    ? interpolate(exitProgress, [0, 1], [1, 0.9])
    : interpolate(entranceProgress, [0, 1], [0.9, 1]);
  const opacity = isExiting
    ? interpolate(exitProgress, [0, 1], [1, 0])
    : interpolate(entranceProgress, [0, 1], [0, 1]);
  const backdropOpacity = isExiting
    ? interpolate(exitProgress, [0, 1], [0.7, 0])
    : interpolate(entranceProgress, [0, 1], [0, 0.7]);
  
  const blurAmount = isExiting
    ? interpolate(exitProgress, [0, 1], [20, 0])
    : interpolate(entranceProgress, [0, 1], [0, 20]);

  // Button click animation
  const isButtonClicked = frame >= BUTTON_CLICK_FRAME;
  const buttonClickProgress = spring({
    frame: Math.max(0, frame - BUTTON_CLICK_FRAME),
    fps,
    config: { damping: 10, stiffness: 400 },
  });
  const buttonScale = isButtonClicked
    ? interpolate(buttonClickProgress, [0, 0.3, 1], [1, 0.95, 1])
    : 1;

  // Field population - typewriter effect
  const getFieldText = (fieldIndex: number, fullText: string) => {
    const fieldStart = FIELD_START + fieldIndex * FIELD_INTERVAL;
    const charsToShow = Math.floor(
      interpolate(frame - fieldStart, [0, 30], [0, fullText.length], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    );
    return fullText.slice(0, charsToShow);
  };

  const fields = [
    { label: "Status Update", value: "Deal has been signed and closed as won" },
    { label: "Notes for Implementation", value: "Signed as of January 24, 2026. Ready for kickoff." },
  ];

  // Don't render after exit animation completes
  if (!visible || (isExiting && exitProgress > 0.95)) return null;

  return (
    <>
      {/* Backdrop + Modal Container */}
      <div
        style={{
          position: "absolute",
          top: 0, // Include header in dimming
          left: 0, // No sidebar
          right: panelWidth, // Before co-pilot panel
          bottom: 0,
          backgroundColor: `rgba(0, 0, 0, ${backdropOpacity})`,
          backdropFilter: `blur(${blurAmount}px)`,
          WebkitBackdropFilter: `blur(${blurAmount}px)`,
          zIndex: 100, // High z-index to ensure it's on top
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Modal - 2x scaled */}
        <div
          style={{
            transform: `scale(${scale})`,
            opacity,
            width: 900,
            maxHeight: "90%",
            backgroundColor: "#FFFFFF",
            borderRadius: 28,
            boxShadow: "0 30px 100px rgba(0, 0, 0, 0.3)",
            overflow: "hidden",
          }}
        >
        {/* Modal Header - 2x scaled */}
        <div
          style={{
            padding: "36px 48px",
            borderBottom: "0.8px solid #E4E0D9",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 14,
                backgroundColor: "#F1F5F9",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 32,
              }}
            >
              📋
            </div>
            <h3
              style={{
                fontSize: 32,
                fontWeight: 600,
                color: "#1A1A1A",
                margin: 0,
                fontFamily:
                  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              }}
            >
              Implementation Handoff
            </h3>
          </div>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              backgroundColor: "#F5F5F5",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <span style={{ color: "#666666", fontSize: 24 }}>✕</span>
          </div>
        </div>

        {/* Form Content - 2x scaled */}
        <div style={{ padding: 48 }}>
          <p
            style={{
              fontSize: 24,
              color: "#666666",
              margin: "0 0 36px 0",
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            }}
          >
            Send deal details to the implementation team
          </p>

          {/* Form Fields */}
          {fields.map((field, i) => {
            const displayValue = getFieldText(i, field.value);
            const isPopulating = frame >= FIELD_START + i * FIELD_INTERVAL;
            const isComplete =
              frame >= FIELD_START + i * FIELD_INTERVAL + 30;

            return (
              <div key={i} style={{ marginBottom: 28 }}>
                <label
                  style={{
                    fontSize: 20,
                    fontWeight: 500,
                    color: "#666666",
                    display: "block",
                    marginBottom: 12,
                    fontFamily:
                      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  }}
                >
                  {field.label}
                </label>
                  <div
                    style={{
                      padding: "20px 24px",
                      backgroundColor: isComplete
                        ? "#F8FFF8"
                        : isPopulating
                          ? "#F8FAFC"
                          : "#F8F7F5",
                      border: `2px solid ${isComplete ? "#22C55E" : isPopulating ? "#F97316" : "#E5E0D8"}`,
                      borderRadius: 14,
                      minHeight: 32,
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 24,
                        color: displayValue ? "#1A1A1A" : "#999999",
                        fontFamily:
                          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                      }}
                    >
                      {displayValue || "..."}
                    </span>
                    {isPopulating && !isComplete && (
                      <span
                        style={{
                          display: "inline-block",
                          width: 3,
                          height: 26,
                          backgroundColor: "#F97316",
                          marginLeft: 2,
                          animation: "none",
                        }}
                      />
                    )}
                  {isComplete && (
                    <span style={{ marginLeft: "auto", color: "#22C55E", fontSize: 28 }}>
                      ✓
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {/* Submit Button - 2x scaled */}
          <button
            style={{
              width: "100%",
              marginTop: 20,
              padding: "24px 36px",
              backgroundColor: isButtonClicked
                ? "#22C55E" // Green when clicked
                : frame >= FIELD_START + fields.length * FIELD_INTERVAL + 15
                  ? "#F97316" // Orange
                  : "#E5E0D8",
              border: "none",
              borderRadius: 16,
              fontSize: 26,
              fontWeight: 600,
              color:
                frame >= FIELD_START + fields.length * FIELD_INTERVAL + 15
                  ? "#FFFFFF"
                  : "#999999",
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              cursor: "pointer",
              transform: `scale(${buttonScale})`,
              transition: "background-color 0.1s",
            }}
          >
            {isButtonClicked ? "✓ Sent!" : "Send to Implementation Team"}
          </button>
        </div>
        </div>
      </div>
    </>
  );
};
