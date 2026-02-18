import { spring, interpolate } from "remotion";
import { SCENE_TIMING } from "./CameraController";
import { TypeDropdown } from "./TypeDropdown";
import { PriorityDropdown } from "./PriorityDropdown";
import { CycleDropdown } from "./CycleDropdown";
import { BlinkingCursor } from "./BlinkingCursor";

type IssueModalProps = {
  frame: number;
  fps: number;
  entranceFrame: number;
  panelWidth: number;
};

export const IssueModal = ({
  frame,
  fps,
  entranceFrame,
  panelWidth,
}: IssueModalProps) => {
  // Modal entrance animation
  const entranceProgress = spring({
    frame: Math.max(0, frame - entranceFrame),
    fps,
    config: { damping: 20, stiffness: 200 },
  });

  const modalScale = interpolate(entranceProgress, [0, 1], [0.95, 1]);
  const modalOpacity = interpolate(entranceProgress, [0, 1], [0, 1]);
  const backdropOpacity = interpolate(entranceProgress, [0, 1], [0, 0.4]);

  // Title typewriter effect (Scene 8: frames 330-375)
  const titleText = "Checkout crash on payment confirmation";
  const titleStartFrame = SCENE_TIMING.PREFILL_TITLE;
  const titleDuration = 30; // 1 second to type

  const charsToShow = Math.floor(
    interpolate(
      frame - titleStartFrame,
      [0, titleDuration],
      [0, titleText.length],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    )
  );

  const displayTitle = frame >= titleStartFrame ? titleText.slice(0, charsToShow) : "";
  const isTitleTyping = frame >= titleStartFrame && frame < titleStartFrame + titleDuration;

  // Create button animation (Scene 9: end)
  const buttonClickFrame = SCENE_TIMING.SUCCESS - 15;
  const isButtonClicked = frame >= buttonClickFrame && frame < SCENE_TIMING.SUCCESS;

  const buttonProgress = spring({
    frame: Math.max(0, frame - buttonClickFrame),
    fps,
    config: { damping: 10, stiffness: 400 },
  });

  const buttonScale = isButtonClicked
    ? interpolate(buttonProgress, [0, 0.5, 1], [1, 0.95, 1])
    : 1;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: panelWidth,
        bottom: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 40,
      }}
    >
      {/* Backdrop */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "#000000",
          opacity: backdropOpacity,
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: "relative",
          width: 560,
          backgroundColor: "#FFFFFF",
          borderRadius: 12,
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          opacity: modalOpacity,
          transform: `scale(${modalScale})`,
          overflow: "visible",
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid #E5E7EB",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h2
            style={{
              fontSize: 20,
              fontWeight: 600,
              color: "#1A1A1A",
              margin: 0,
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            }}
          >
            Create Issue
          </h2>
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
            <span style={{ color: "#666666", fontSize: 14, lineHeight: 1 }}>✕</span>
          </div>
        </div>

        {/* Modal Body */}
        <div
          style={{
            padding: 24,
            display: "flex",
            flexDirection: "column",
            gap: 20,
            overflow: "visible",
          }}
        >
          {/* Title Field */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: 14,
                fontWeight: 500,
                color: "#374151",
                marginBottom: 8,
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              }}
            >
              Title
            </label>
            <div
              style={{
                padding: "12px 16px",
                backgroundColor: "#FFFFFF",
                border: isTitleTyping ? "2px solid #3B82F6" : "1px solid #E5E7EB",
                borderRadius: 8,
                fontSize: 16,
                color: displayTitle ? "#1A1A1A" : "#9CA3AF",
                minHeight: 24,
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                boxShadow: isTitleTyping ? "0 0 0 3px rgba(59, 130, 246, 0.1)" : "none",
              }}
            >
              {displayTitle || "Issue title"}
              {isTitleTyping && (
                <BlinkingCursor frame={frame} startFrame={titleStartFrame} visible={true} />
              )}
            </div>
          </div>

          {/* Type and Priority Row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
            }}
          >
            {/* Type Dropdown */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 14,
                  fontWeight: 500,
                  color: "#374151",
                  marginBottom: 8,
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                }}
              >
                Type
              </label>
              <TypeDropdown frame={frame} fps={fps} />
            </div>

            {/* Priority Dropdown */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 14,
                  fontWeight: 500,
                  color: "#374151",
                  marginBottom: 8,
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                }}
              >
                Priority
              </label>
              <PriorityDropdown frame={frame} fps={fps} />
            </div>
          </div>

          {/* Cycle Dropdown */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: 14,
                fontWeight: 500,
                color: "#374151",
                marginBottom: 8,
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              }}
            >
              Cycle
            </label>
            <CycleDropdown frame={frame} fps={fps} />
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid #E5E7EB",
            display: "flex",
            justifyContent: "flex-end",
            gap: 12,
          }}
        >
          <button
            style={{
              padding: "10px 20px",
              backgroundColor: "#FFFFFF",
              border: "1px solid #E5E7EB",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 500,
              color: "#374151",
              cursor: "pointer",
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            }}
          >
            Cancel
          </button>
          <button
            style={{
              padding: "10px 24px",
              backgroundColor: isButtonClicked ? "#22C55E" : "#3B82F6",
              border: "none",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              color: "#FFFFFF",
              cursor: "pointer",
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              transform: `scale(${buttonScale})`,
              boxShadow: isButtonClicked ? "0 0 0 4px rgba(34, 197, 94, 0.2)" : "none",
            }}
          >
            {isButtonClicked ? "Creating..." : "Create Issue"}
          </button>
        </div>
      </div>
    </div>
  );
};
