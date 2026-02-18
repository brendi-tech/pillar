import { spring, interpolate } from "remotion";
import { SCENE_TIMING } from "./CameraController";

type PriorityDropdownProps = {
  frame: number;
  fps: number;
};

// Priority options
const PRIORITY_OPTIONS = [
  { value: "none", label: "No priority", color: "#9CA3AF", bg: "transparent" },
  { value: "P1", label: "P1 - Urgent", color: "#F43F5E", bg: "rgba(244, 63, 94, 0.15)" },
  { value: "P2", label: "P2 - High", color: "#F97316", bg: "rgba(249, 115, 22, 0.15)" },
  { value: "P3", label: "P3 - Medium", color: "#D97706", bg: "rgba(251, 191, 36, 0.15)" },
  { value: "P4", label: "P4 - Low", color: "#6B7280", bg: "rgba(156, 163, 175, 0.15)" },
];

export const PriorityDropdown = ({ frame, fps }: PriorityDropdownProps) => {
  // Timing: Priority selection happens in Scene 7 (frames 285-330)
  const openFrame = SCENE_TIMING.SET_PRIORITY;
  const selectFrame = SCENE_TIMING.SET_PRIORITY + 25; // Select after 25 frames
  const closeFrame = SCENE_TIMING.SET_PRIORITY + 35; // Close after 35 frames

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

  // Current selection
  const currentOption = isSelected ? PRIORITY_OPTIONS[1] : PRIORITY_OPTIONS[0]; // P1 after selection

  // Badge pulse animation on selection
  const pulseProgress = spring({
    frame: Math.max(0, frame - selectFrame),
    fps,
    config: { damping: 10, stiffness: 400 },
  });

  const badgeScale = isSelected
    ? interpolate(pulseProgress, [0, 0.3, 1], [1, 1.15, 1])
    : 1;

  // Highlight animation on selection
  const highlightOpacity = isSelected && frame < closeFrame
    ? interpolate(pulseProgress, [0, 0.5, 1], [0, 0.3, 0])
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
            gap: 8,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          }}
        >
          {isSelected ? (
            <span
              style={{
                padding: "2px 8px",
                backgroundColor: currentOption.bg,
                color: currentOption.color,
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 600,
                transform: `scale(${badgeScale})`,
                display: "inline-block",
              }}
            >
              P1
            </span>
          ) : (
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                border: "2px dashed #D1D5DB",
              }}
            />
          )}
          <span
            style={{
              fontSize: 14,
              color: isSelected ? currentOption.color : "#6B7280",
              fontWeight: isSelected ? 500 : 400,
            }}
          >
            {isSelected ? "Urgent" : "No priority"}
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
          {PRIORITY_OPTIONS.map((option) => {
            const isHighlighted = option.value === "P1" && frame >= selectFrame - 10;
            const isCurrentlySelected = option.value === "P1" && frame >= selectFrame;

            return (
              <div
                key={option.value}
                style={{
                  padding: "10px 14px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  backgroundColor: isHighlighted
                    ? "rgba(59, 130, 246, 0.1)"
                    : "#FFFFFF",
                  borderLeft: isHighlighted ? "3px solid #3B82F6" : "3px solid transparent",
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  position: "relative",
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
                      backgroundColor: option.color,
                      opacity: highlightOpacity,
                    }}
                  />
                )}
                {/* Priority indicator */}
                {option.value === "none" ? (
                  <span
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: "50%",
                      border: "2px dashed #D1D5DB",
                    }}
                  />
                ) : (
                  <span
                    style={{
                      padding: "2px 6px",
                      backgroundColor: option.bg,
                      color: option.color,
                      borderRadius: 3,
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    {option.value}
                  </span>
                )}
                <span
                  style={{
                    fontSize: 14,
                    color: option.color,
                    fontWeight: isHighlighted ? 500 : 400,
                  }}
                >
                  {option.label}
                </span>
                {isCurrentlySelected && (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#3B82F6"
                    strokeWidth="2.5"
                    style={{ marginLeft: "auto" }}
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
