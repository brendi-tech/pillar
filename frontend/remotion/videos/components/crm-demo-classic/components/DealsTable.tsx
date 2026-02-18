import { interpolate, spring } from "remotion";

type DealsTableProps = {
  floatOffset: number;
  frame: number;
  fps: number;
};

// Scene timing
const SEARCH_START = 185; // Aligned with camera zoom-out completion
const SEARCH_HIGHLIGHT_PEAK = 205; // Walmart row highlight peaks (midway through search)
const SEARCH_COMPLETE = 220; // Search animation complete (~35 frames for full animation)

const sampleDeals = [
  {
    name: "Enterprise License - Walmart",
    company: "Walmart Inc.",
    value: "$425,000",
    stage: "Negotiation",
    stageColor: "#64748B",
    closeDate: "Jan 24, 2026",
    owner: "Jane D.",
    isWalmartDeal: true,
  },
  {
    name: "Annual Subscription - DataFlow",
    company: "DataFlow Systems",
    value: "$78,500",
    stage: "Proposal",
    stageColor: "#3B82F6",
    closeDate: "Jan 31, 2026",
    owner: "Mike R.",
    isWalmartDeal: false,
  },
  {
    name: "Platform Migration - GlobalBank",
    company: "GlobalBank Ltd.",
    value: "$250,000",
    stage: "Discovery",
    stageColor: "#94A3B8",
    closeDate: "Feb 15, 2026",
    owner: "Jane D.",
    isWalmartDeal: false,
  },
  {
    name: "SaaS Implementation - RetailMax",
    company: "RetailMax Corp",
    value: "$92,000",
    stage: "Proposal",
    stageColor: "#3B82F6",
    closeDate: "Feb 10, 2026",
    owner: "Sarah L.",
    isWalmartDeal: false,
  },
  {
    name: "API Integration - FinServe",
    company: "FinServe Solutions",
    value: "$145,000",
    stage: "Negotiation",
    stageColor: "#64748B",
    closeDate: "Feb 08, 2026",
    owner: "Mike R.",
    isWalmartDeal: false,
  },
  {
    name: "Custom Development - MedTech",
    company: "MedTech Innovations",
    value: "$180,000",
    stage: "Discovery",
    stageColor: "#94A3B8",
    closeDate: "Feb 20, 2026",
    owner: "Jane D.",
    isWalmartDeal: false,
  },
];

export const DealsTable = ({ floatOffset, frame, fps }: DealsTableProps) => {
  // Scene 5: Search animation - Walmart row highlights
  const isSearching = frame >= SEARCH_START && frame < SEARCH_COMPLETE;
  
  // Scanning effect - a visual line that moves down the table
  const scanProgress = interpolate(
    frame - SEARCH_START,
    [0, 30],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Walmart row highlight with pulse effect
  const walmartHighlightProgress = spring({
    frame: Math.max(0, frame - (SEARCH_START + 10)),
    fps,
    config: { damping: 12, stiffness: 200 },
  });

  // Pulse animation for Walmart row (glows then fades)
  const walmartGlow = interpolate(
    frame - SEARCH_START,
    [10, 20, 35, 50],
    [0, 0.4, 0.25, 0.15],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Border glow for Walmart row
  const walmartBorderOpacity = interpolate(
    frame - SEARCH_START,
    [10, 20, 240, 285],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <div
      style={{
        backgroundColor: "#FFFFFF",
        borderRadius: 8,
        border: "0.8px solid #E4E0D9",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Scanning line effect during search */}
      {isSearching && scanProgress < 1 && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            height: 2,
            background: "linear-gradient(90deg, transparent, #F97316, transparent)",
            top: `${scanProgress * 100}%`,
            opacity: 1 - scanProgress,
            zIndex: 10,
            boxShadow: "0 0 10px rgba(249, 115, 22, 0.5)",
          }}
        />
      )}

      {/* Table Header */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1.5fr 1fr 1fr 1fr 0.8fr",
          padding: "14px 28px",
          backgroundColor: "#FAFAFA",
          borderBottom: "0.8px solid #E4E0D9",
          gap: 16,
        }}
      >
        {["Deal Name", "Company", "Value", "Stage", "Close Date", "Owner"].map(
          (header, i) => (
            <span
              key={i}
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "#666666",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                fontFamily:
                  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              }}
            >
              {header}
            </span>
          )
        )}
      </div>

      {/* Table Rows */}
      {sampleDeals.map((deal, index) => {
        const isWalmart = deal.isWalmartDeal;

        return (
          <div
            key={index}
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1.5fr 1fr 1fr 1fr 0.8fr",
              padding: "14px 28px",
              borderBottom:
                index < sampleDeals.length - 1 ? "0.8px solid #E4E0D9" : "none",
              alignItems: "center",
              gap: 16,
              backgroundColor: isWalmart
                ? `rgba(249, 115, 22, ${walmartGlow})`
                : index % 2 === 1
                  ? "#FAFAFA"
                  : "#FFFFFF",
              position: "relative",
              boxShadow: isWalmart && walmartBorderOpacity > 0
                ? `inset 0 0 0 2px rgba(249, 115, 22, ${walmartBorderOpacity})`
                : "none",
              transition: "none",
            }}
          >
            {/* Deal Name */}
            <span
              style={{
                fontSize: 18,
                fontWeight: isWalmart && frame >= SEARCH_START ? 600 : 500,
                color: "#1A1A1A",
                fontFamily:
                  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              }}
            >
              {deal.name}
            </span>

            {/* Company */}
            <span
              style={{
                fontSize: 16,
                color: "#666666",
                fontFamily:
                  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              }}
            >
              {deal.company}
            </span>

            {/* Value */}
            <span
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: "#1A1A1A",
                fontFamily:
                  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace',
              }}
            >
              {deal.value}
            </span>

            {/* Stage */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "6px 12px",
                backgroundColor: `${deal.stageColor}20`,
                borderRadius: 4,
                width: "fit-content",
              }}
            >
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: deal.stageColor,
                  fontFamily:
                    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                }}
              >
                {deal.stage}
              </span>
            </div>

            {/* Close Date */}
            <span
              style={{
                fontSize: 16,
                color: "#666666",
                fontFamily:
                  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              }}
            >
              {deal.closeDate}
            </span>

            {/* Owner */}
            <span
              style={{
                fontSize: 16,
                color: "#666666",
                fontFamily:
                  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              }}
            >
              {deal.owner}
            </span>
          </div>
        );
      })}
    </div>
  );
};
