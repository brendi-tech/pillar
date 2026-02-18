type TopBarProps = {
  frame: number;
  floatOffset: number;
  title: string;
};

export const TopBar = ({
  floatOffset,
  title,
}: TopBarProps) => {
  return (
    <div
      style={{
        height: 64,
        backgroundColor: "#FFFFFF",
        borderBottom: "1px solid #E5E0D8",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        transform: `translateY(${floatOffset * 0.3}px)`,
      }}
    >
      {/* Left side - Logo and title */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        {/* Analytics logo placeholder */}
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            backgroundColor: "#22C55E",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="2"
          >
            <polyline points="4 18 8 12 12 15 16 8 20 12" />
          </svg>
        </div>
        
        <span
          style={{
            fontSize: 20,
            fontWeight: 600,
            color: "#1A1A1A",
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          }}
        >
          {title}
        </span>
      </div>
      
      {/* Right side - Actions */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        {/* Search */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 16px",
            backgroundColor: "#F8F7F5",
            borderRadius: 8,
            border: "1px solid #E5E0D8",
          }}
        >
          <svg
            width="16"
            height="16"
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
              fontSize: 14,
              color: "#999999",
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            }}
          >
            Search...
          </span>
        </div>
        
        {/* Notifications */}
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            backgroundColor: "#F8F7F5",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#666666"
            strokeWidth="2"
          >
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </div>
        
        {/* Profile */}
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            backgroundColor: "#3B82F6",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "#FFFFFF",
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            }}
          >
            JD
          </span>
        </div>
      </div>
    </div>
  );
};
