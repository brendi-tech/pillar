import { ActiveCycleView } from "./ActiveCycleView";

type LinearBackgroundProps = {
  frame: number;
  fps: number;
  floatOffset: number;
  panelWidth: number;
  showNewIssue: boolean;
  issueId: string;
};

export const LinearBackground = ({
  frame,
  fps,
  floatOffset,
  panelWidth,
  showNewIssue,
  issueId,
}: LinearBackgroundProps) => {
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        right: panelWidth,
        backgroundColor: "#FBFBFB",
        display: "flex",
        flexDirection: "column",
        transform: `translateY(${floatOffset * 0.2}px)`,
      }}
    >
      {/* Top Navigation Bar */}
      <div
        style={{
          height: 56,
          backgroundColor: "#FFFFFF",
          borderBottom: "1px solid #E5E7EB",
          display: "flex",
          alignItems: "center",
          padding: "0 24px",
          gap: 16,
        }}
      >
        {/* Linear Logo */}
        <svg
          width="24"
          height="24"
          viewBox="0 0 100 100"
          fill="none"
        >
          <rect width="100" height="100" rx="18" fill="#5E6AD2" />
          <path
            d="M25 75L75 25"
            stroke="white"
            strokeWidth="12"
            strokeLinecap="round"
          />
          <path
            d="M25 50L50 25"
            stroke="white"
            strokeWidth="12"
            strokeLinecap="round"
          />
          <path
            d="M50 75L75 50"
            stroke="white"
            strokeWidth="12"
            strokeLinecap="round"
          />
        </svg>

        {/* Breadcrumb */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontSize: 14,
            color: "#6B7280",
          }}
        >
          <span>Pillar</span>
          <span>/</span>
          <span style={{ color: "#1A1A1A", fontWeight: 500 }}>Active Cycle</span>
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Right side icons */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          {/* Search icon */}
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 6,
              backgroundColor: "#F3F4F6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
          </div>

          {/* Avatar */}
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              backgroundColor: "#3B82F6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#FFFFFF",
              fontSize: 14,
              fontWeight: 600,
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            }}
          >
            JM
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div
        style={{
          flex: 1,
          padding: "32px 48px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Page Header */}
        <div
          style={{
            marginBottom: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <h1
              style={{
                fontSize: 32,
                fontWeight: 600,
                color: "#1A1A1A",
                margin: 0,
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              }}
            >
              Sprint 23
            </h1>
            <p
              style={{
                fontSize: 14,
                color: "#6B7280",
                margin: "4px 0 0 0",
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              }}
            >
              Jan 20 - Feb 3, 2026 · Active Cycle
            </p>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              style={{
                padding: "8px 16px",
                backgroundColor: "#FFFFFF",
                border: "1px solid #E5E7EB",
                borderRadius: 6,
                fontSize: 14,
                fontWeight: 500,
                color: "#374151",
                cursor: "pointer",
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              }}
            >
              Filter
            </button>
            <button
              style={{
                padding: "8px 16px",
                backgroundColor: "#3B82F6",
                border: "none",
                borderRadius: 6,
                fontSize: 14,
                fontWeight: 500,
                color: "#FFFFFF",
                cursor: "pointer",
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              }}
            >
              + New Issue
            </button>
          </div>
        </div>

        {/* Issue List */}
        <ActiveCycleView
          frame={frame}
          fps={fps}
          showNewIssue={showNewIssue}
          issueId={issueId}
        />
      </div>
    </div>
  );
};
