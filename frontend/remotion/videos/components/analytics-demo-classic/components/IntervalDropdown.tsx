import { interpolate, spring } from "remotion";

type IntervalDropdownProps = {
  frame: number;
  fps: number;
  isOpen: boolean;
  openFrame: number;
  selectedInterval: string;
  selectFrame: number;
};

const INTERVALS = ["Hourly", "Daily", "Weekly", "Monthly"];

export const IntervalDropdown = ({
  frame,
  fps,
  isOpen,
  openFrame,
  selectedInterval,
  selectFrame,
}: IntervalDropdownProps) => {
  // Dropdown open animation
  const openProgress = spring({
    frame: Math.max(0, frame - openFrame),
    fps,
    config: { damping: 20, stiffness: 200 },
  });
  
  // Selection highlight animation
  const selectionProgress = spring({
    frame: Math.max(0, frame - selectFrame),
    fps,
    config: { damping: 15, stiffness: 200 },
  });
  
  const dropdownHeight = interpolate(openProgress, [0, 1], [0, 180]);
  const dropdownOpacity = interpolate(openProgress, [0, 1], [0, 1]);
  
  return (
    <div
      style={{
        position: "relative",
        width: 200,
      }}
    >
      {/* Trigger button */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          backgroundColor: isOpen ? "#FFFFFF" : "#F8F7F5",
          border: `2px solid ${isOpen ? "#22C55E" : "#E5E0D8"}`,
          borderRadius: 10,
          cursor: "pointer",
        }}
      >
        <span
          style={{
            fontSize: 16,
            color: "#1A1A1A",
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          }}
        >
          {selectedInterval}
        </span>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#666666"
          strokeWidth="2"
          style={{
            transform: `rotate(${isOpen ? 180 : 0}deg)`,
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
      
      {/* Dropdown menu */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            backgroundColor: "#FFFFFF",
            border: "1px solid #E5E0D8",
            borderRadius: 10,
            boxShadow: "0 6px 20px rgba(0, 0, 0, 0.1)",
            overflow: "hidden",
            height: dropdownHeight,
            opacity: dropdownOpacity,
            zIndex: 10,
          }}
        >
          <div
            style={{
              padding: "6px 0",
            }}
          >
            {INTERVALS.map((interval) => {
              const isSelected = interval === selectedInterval && frame >= selectFrame;
              
              return (
                <div
                  key={interval}
                  style={{
                    padding: "10px 16px",
                    backgroundColor: isSelected
                      ? `rgba(34, 197, 94, ${0.1 * selectionProgress})`
                      : "transparent",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  {isSelected && (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#22C55E"
                      strokeWidth="3"
                      style={{
                        opacity: selectionProgress,
                        transform: `scale(${selectionProgress})`,
                      }}
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                  <span
                    style={{
                      fontSize: 15,
                      color: isSelected ? "#22C55E" : "#1A1A1A",
                      fontWeight: isSelected ? 500 : 400,
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    }}
                  >
                    {interval}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
