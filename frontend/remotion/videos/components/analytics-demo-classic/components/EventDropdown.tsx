import { interpolate, spring } from "remotion";

type EventDropdownProps = {
  frame: number;
  fps: number;
  isOpen: boolean;
  openFrame: number;
  selectedEvent: string | null;
  selectFrame: number;
  searchText: string;
  searchStartFrame: number;
};

const EVENTS = [
  "User Signups",
  "User Login",
  "Page View",
  "Button Click",
  "Purchase Complete",
];

export const EventDropdown = ({
  frame,
  fps,
  isOpen,
  openFrame,
  selectedEvent,
  selectFrame,
  searchText,
  searchStartFrame,
}: EventDropdownProps) => {
  // Dropdown open animation
  const openProgress = spring({
    frame: Math.max(0, frame - openFrame),
    fps,
    config: { damping: 20, stiffness: 200 },
  });
  
  // Search text typewriter
  const charsToShow = Math.floor(
    interpolate(frame - searchStartFrame, [0, 20], [0, searchText.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
  );
  const displaySearchText = searchText.slice(0, charsToShow);
  
  // Filter events based on search
  const filteredEvents = displaySearchText
    ? EVENTS.filter(e => e.toLowerCase().includes(displaySearchText.toLowerCase()))
    : EVENTS;
  
  // Selection highlight animation
  const selectionProgress = spring({
    frame: Math.max(0, frame - selectFrame),
    fps,
    config: { damping: 15, stiffness: 200 },
  });
  
  const dropdownHeight = interpolate(openProgress, [0, 1], [0, 280]);
  const dropdownOpacity = interpolate(openProgress, [0, 1], [0, 1]);
  
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
      }}
    >
      {/* Trigger button */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 20px",
          backgroundColor: isOpen ? "#FFFFFF" : "#F8F7F5",
          border: `2px solid ${isOpen ? "#22C55E" : "#E5E0D8"}`,
          borderRadius: 12,
          cursor: "pointer",
        }}
      >
        <span
          style={{
            fontSize: 18,
            color: selectedEvent ? "#1A1A1A" : "#999999",
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          }}
        >
          {selectedEvent || "Select event..."}
        </span>
        <svg
          width="20"
          height="20"
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
            top: "calc(100% + 8px)",
            left: 0,
            right: 0,
            backgroundColor: "#FFFFFF",
            border: "1px solid #E5E0D8",
            borderRadius: 12,
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.12)",
            overflow: "hidden",
            height: dropdownHeight,
            opacity: dropdownOpacity,
            zIndex: 10,
          }}
        >
          {/* Search input */}
          <div
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid #E5E0D8",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 14px",
                backgroundColor: "#F8F7F5",
                borderRadius: 8,
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#999999"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <span
                style={{
                  fontSize: 16,
                  color: displaySearchText ? "#1A1A1A" : "#999999",
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                }}
              >
                {displaySearchText || "Search events..."}
                {frame >= searchStartFrame && frame < searchStartFrame + 30 && (
                  <span
                    style={{
                      display: "inline-block",
                      width: 2,
                      height: 16,
                      backgroundColor: Math.floor((frame - searchStartFrame) / 8) % 2 === 0 ? "#1A1A1A" : "transparent",
                      marginLeft: 1,
                      verticalAlign: "text-bottom",
                    }}
                  />
                )}
              </span>
            </div>
          </div>
          
          {/* Event options */}
          <div
            style={{
              padding: "8px 0",
              maxHeight: 200,
              overflow: "hidden",
            }}
          >
            {filteredEvents.map((event, index) => {
              const isSelected = event === selectedEvent;
              const isHighlighted = isSelected && frame >= selectFrame;
              
              return (
                <div
                  key={event}
                  style={{
                    padding: "12px 16px",
                    backgroundColor: isHighlighted
                      ? `rgba(34, 197, 94, ${0.1 * selectionProgress})`
                      : "transparent",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  {isHighlighted && (
                    <svg
                      width="18"
                      height="18"
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
                      fontSize: 16,
                      color: isHighlighted ? "#22C55E" : "#1A1A1A",
                      fontWeight: isHighlighted ? 500 : 400,
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    }}
                  >
                    {event}
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
