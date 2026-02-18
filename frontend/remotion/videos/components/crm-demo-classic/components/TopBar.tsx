type TopBarProps = {
  floatOffset: number;
};

export const TopBar = ({ floatOffset }: TopBarProps) => {
  return (
    <div
      style={{
        height: 56,
        backgroundColor: "#FFFFFF",
        borderBottom: "0.8px solid #E4E0D9",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        transform: `translateY(${floatOffset * 0.2}px)`,
      }}
    >
      {/* Search Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          backgroundColor: "#F5F5F5",
          borderRadius: 8,
          padding: "8px 14px",
          width: 280,
          gap: 8,
        }}
      >
        <span style={{ color: "#999999", fontSize: 14 }}>🔍</span>
        <span
          style={{
            color: "#999999",
            fontSize: 13,
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          }}
        >
          Search deals, contacts, companies...
        </span>
      </div>

      {/* Right side - notifications and profile */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        {/* Notification Bell */}
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 6,
            backgroundColor: "#F5F5F5",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            cursor: "pointer",
          }}
        >
          <span style={{ fontSize: 14 }}>🔔</span>
          <div
            style={{
              position: "absolute",
              top: 4,
              right: 4,
              width: 6,
              height: 6,
              backgroundColor: "#F97316",
              borderRadius: "50%",
            }}
          />
        </div>

        {/* Help */}
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 6,
            backgroundColor: "#F5F5F5",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <span style={{ fontSize: 14 }}>❓</span>
        </div>

        {/* User Avatar */}
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            backgroundColor: "#4A90D9",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            fontWeight: 500,
            color: "#FFFFFF",
            cursor: "pointer",
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          }}
        >
          JD
        </div>
      </div>
    </div>
  );
};
