import { spring, interpolate } from "remotion";
import { SCENE_TIMING } from "./CameraController";

type TypeDropdownProps = {
  frame: number;
  fps: number;
};

// Type options
const TYPE_OPTIONS = [
  { value: "issue", label: "Issue", icon: "📋" },
  { value: "bug", label: "Bug", icon: "🐛", color: "#EF4444" },
  { value: "feature", label: "Feature", icon: "✨" },
  { value: "improvement", label: "Improvement", icon: "🔧" },
];

export const TypeDropdown = ({ frame, fps }: TypeDropdownProps) => {
  // Timing: Type selection happens in Scene 6 (frames 240-285)
  const openFrame = SCENE_TIMING.SET_TYPE;
  const selectFrame = SCENE_TIMING.SET_TYPE + 25; // Select after 25 frames
  const closeFrame = SCENE_TIMING.SET_TYPE + 35; // Close after 35 frames

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
  const currentOption = isSelected ? TYPE_OPTIONS[1] : TYPE_OPTIONS[0]; // Bug after selection

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
            gap: 8,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          }}
        >
          <span style={{ fontSize: 16 }}>{currentOption.icon}</span>
          <span
            style={{
              fontSize: 14,
              color: "#1A1A1A",
              fontWeight: isSelected ? 500 : 400,
            }}
          >
            {currentOption.label}
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
          {TYPE_OPTIONS.map((option, index) => {
            const isHighlighted = option.value === "bug" && frame >= selectFrame - 10;
            const isCurrentlySelected = option.value === "bug" && frame >= selectFrame;

            return (
              <div
                key={option.value}
                style={{
                  padding: "10px 14px",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
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
                      backgroundColor: "#3B82F6",
                      opacity: highlightOpacity,
                    }}
                  />
                )}
                <span style={{ fontSize: 16 }}>{option.icon}</span>
                <span
                  style={{
                    fontSize: 14,
                    color: option.color || "#1A1A1A",
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
