import { AbsoluteFill, interpolate } from "remotion";
import { TopBar } from "./TopBar";
import { DealsTable } from "./DealsTable";
import { DealDetailView } from "./DealDetailView";

type CRMBackgroundProps = {
  frame: number;
  fps: number;
  floatOffset: number;
  panelWidth: number;
};

// View transition timing
const DEAL_DETAIL_START = 220; // Step 2 starts, deal detail opens (after search completes)

export const CRMBackground = ({
  frame,
  fps,
  floatOffset,
  panelWidth,
}: CRMBackgroundProps) => {
  // Determine which view to show
  const showPipeline = frame < DEAL_DETAIL_START;
  const showDealDetail = frame >= DEAL_DETAIL_START;

  // Pipeline fade out when transitioning to deal detail
  const pipelineOpacity = interpolate(
    frame,
    [DEAL_DETAIL_START - 10, DEAL_DETAIL_START + 10],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <>
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "row",
        }}
      >
        {/* Main Content Area - Pipeline View (fills left 60%) */}
        {showPipeline && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: panelWidth, // Stop before co-pilot panel
              bottom: 0,
              display: "flex",
              flexDirection: "column",
              opacity: pipelineOpacity,
              backgroundColor: "#FFFFFF",
            }}
          >
            {/* Top Bar */}
            <TopBar floatOffset={floatOffset} />

            {/* Main Content - Deals Pipeline */}
            <div
              style={{
                flex: 1,
                padding: 24,
                backgroundColor: "#FFFFFF",
                transform: `translateY(${floatOffset * 0.5}px)`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 16,
                }}
              >
                <h1
                  style={{
                    fontSize: 22,
                    fontWeight: 600,
                    color: "#1A1A1A",
                    margin: 0,
                    fontFamily:
                      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  }}
                >
                  Deals Pipeline
                </h1>
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    style={{
                      padding: "8px 14px",
                      backgroundColor: "#F5F5F5",
                      border: "0.8px solid #E4E0D9",
                      borderRadius: 6,
                      fontSize: 12,
                      color: "#666666",
                      cursor: "pointer",
                      fontFamily:
                        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    }}
                  >
                    Filter
                  </button>
                  <button
                    style={{
                      padding: "8px 16px",
                      backgroundColor: "#1E293B",
                      border: "none",
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 500,
                      color: "#FFFFFF",
                      cursor: "pointer",
                      fontFamily:
                        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    }}
                  >
                    + New Deal
                  </button>
                </div>
              </div>

              {/* Deals Table */}
              <DealsTable floatOffset={floatOffset} frame={frame} fps={fps} />
            </div>
          </div>
        )}

        {/* Deal Detail View - appears after pipeline */}
        <DealDetailView
          frame={frame}
          fps={fps}
          visible={showDealDetail}
          entranceFrame={DEAL_DETAIL_START}
          panelWidth={panelWidth}
        />

        {/* Top Bar for Deal Detail View */}
        {showDealDetail && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0, // No sidebar offset
              right: panelWidth,
              zIndex: 5,
            }}
          >
            <TopBar floatOffset={floatOffset} />
          </div>
        )}
      </AbsoluteFill>
    </>
  );
};
