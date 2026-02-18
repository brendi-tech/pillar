import { spring, interpolate } from "remotion";
import { SCENE_TIMING } from "./CameraController";

type CycleDropdownProps = {
  frame: number;
  fps: number;
};

// Cycle options
const CYCLE_OPTIONS = [
  { value: "sprint-22", label: "Sprint 22", dates: "Jan 6 - Jan 20", status: "completed" },
  { value: "sprint-23", label: "Sprint 23", dates: "Jan 20 - Feb 3", status: "current" },
  { value: "sprint-24", label: "Sprint 24", dates: "Feb 3 - Feb 17", status: "upcoming" },
];

export const CycleDropdown = ({ frame, fps }: CycleDropdownProps) => {
  // Timing: Cycle selection happens in Scene 9 (frames 375-420)
  const openFrame = SCENE_TIMING.ADD_TO_CYCLE;
  const selectFrame = SCENE_TIMING.ADD_TO_CYCLE + 25; // Select after 25 frames
  const closeFrame = SCENE_TIMING.ADD_TO_CYCLE + 35; // Close after 35 frames

  const isOpen = frame >= openFrame && frame < closeFrame;
  const isSelected = frame >= selectFrame;

  // Dropdown open animation
  const openProgress = isOpen
    ? spring({
        frame: Math.max(0, frame - openFrame),
        fps,
        config: { damping: 20, stiffness: 200 },
      })
    : 0;

  const dropdownScale = interpolate(openProgress, [0, 1], [0.95, 1]);
  const dropdownOpacity = interpolate(openProgress, [0, 1], [0, 1]);

  // Current selection - always Sprint 23 after selection
  const currentOption = CYCLE_OPTIONS[1]; // Sprint 23

  // Highlight animation on selection
  const selectProgress = spring({
    frame: Math.max(0, frame - selectFrame),
    fps,
    config: { damping: 15, stiffness: 300 },
  });

  const highlightOpacity = isSelected && frame < closeFrame
    ? interpolate(selectProgress, [0, 0.5, 1], [0, 0.3, 0])
    : 0;

  return (
    <div style={{ position: "relative" }}>
      {/* Selected value */}
      <div
        style={{
          padding: "10px 14px",
          backgroundColor: "#FFFFFF",
          border: isOpen ? "2px solid #3B82F6" : "1px solid #E5E7EB",
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
          boxShadow: isOpen ? "0 0 0 3px rgba(59, 130, 246, 0.1)" : "none",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          }}
        >
          {/* Cycle icon */}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <div>
            <span
              style={{
                fontSize: 14,
                color: "#1A1A1A",
                fontWeight: 500,
              }}
            >
              {currentOption.label}
            </span>
            <span
              style={{
                fontSize: 12,
                color: "#6B7280",
                marginLeft: 8,
              }}
            >
              {currentOption.dates}
            </span>
          </div>
          {/* Current badge */}
          <span
            style={{
              padding: "2px 8px",
              backgroundColor: "rgba(59, 130, 246, 0.1)",
              color: "#3B82F6",
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
            }}
          >
            Current
          </span>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>

      {/* Dropdown menu */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: 4,
            backgroundColor: "#FFFFFF",
            border: "1px solid #E5E7EB",
            borderRadius: 8,
            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
            overflow: "hidden",
            opacity: dropdownOpacity,
            transform: `scale(${dropdownScale})`,
            transformOrigin: "top",
            zIndex: 100,
          }}
        >
          {CYCLE_OPTIONS.map((option) => {
            const isHighlighted = option.value === "sprint-23" && frame >= selectFrame - 10;
            const isCurrentlySelected = option.value === "sprint-23" && frame >= selectFrame;

            return (
              <div
                key={option.value}
                style={{
                  padding: "12px 14px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  backgroundColor: isHighlighted
                    ? "rgba(59, 130, 246, 0.1)"
                    : "#FFFFFF",
                  borderLeft: isHighlighted ? "3px solid #3B82F6" : "3px solid transparent",
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  position: "relative",
                  opacity: option.status === "completed" ? 0.6 : 1,
                }}
              >
                {/* Selection flash */}
                {isCurrentlySelected && (
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: "#3B82F6",
                      opacity: highlightOpacity,
                    }}
                  />
                )}
                {/* Cycle icon */}
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={option.status === "current" ? "#3B82F6" : "#9CA3AF"}
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        fontSize: 14,
                        color: "#1A1A1A",
                        fontWeight: isHighlighted ? 500 : 400,
                      }}
                    >
                      {option.label}
                    </span>
                    {option.status === "current" && (
                      <span
                        style={{
                          padding: "2px 6px",
                          backgroundColor: "rgba(59, 130, 246, 0.1)",
                          color: "#3B82F6",
                          borderRadius: 3,
                          fontSize: 10,
                          fontWeight: 600,
                          textTransform: "uppercase",
                        }}
                      >
                        Current
                      </span>
                    )}
                    {option.status === "completed" && (
                      <span
                        style={{
                          padding: "2px 6px",
                          backgroundColor: "rgba(34, 197, 94, 0.1)",
                          color: "#22C55E",
                          borderRadius: 3,
                          fontSize: 10,
                          fontWeight: 600,
                          textTransform: "uppercase",
                        }}
                      >
                        Completed
                      </span>
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: 12,
                      color: "#6B7280",
                    }}
                  >
                    {option.dates}
                  </span>
                </div>
                {isCurrentlySelected && (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#3B82F6"
                    strokeWidth="2.5"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
