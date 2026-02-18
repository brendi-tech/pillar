import { interpolate, spring } from "remotion";
import { TopBar } from "./TopBar";
import { DashboardGrid } from "./DashboardGrid";
import { ChartEditor } from "./ChartEditor";
import { ToastNotification } from "./ToastNotification";
import { SCENE_TIMING } from "./CameraController";

type AnalyticsContentProps = {
  frame: number;
  fps: number;
  floatOffset: number;
  panelWidth: number;
};

// View states
type ViewState = "dashboard" | "chartEditor" | "dashboardWithNewChart";

export const AnalyticsContent = ({
  frame,
  fps,
  floatOffset,
  panelWidth,
}: AnalyticsContentProps) => {
  // Determine current view based on frame
  let currentView: ViewState = "dashboard";
  
  // Chart editor starts when "List data sets" step begins
  if (frame >= SCENE_TIMING.LIST_DATASETS_START && frame < SCENE_TIMING.SUCCESS_START) {
    currentView = "chartEditor";
  } else if (frame >= SCENE_TIMING.SUCCESS_START) {
    currentView = "dashboardWithNewChart";
  }
  
  // Navigation highlight animation (before chart editor opens)
  const navHighlightProgress = spring({
    frame: Math.max(0, frame - (SCENE_TIMING.LIST_DATASETS_START - 20)),
    fps,
    config: { damping: 15, stiffness: 200 },
  });
  
  // Transition from dashboard to chart editor
  const dashboardToEditorProgress = interpolate(
    frame,
    [SCENE_TIMING.LIST_DATASETS_START - 10, SCENE_TIMING.LIST_DATASETS_START + 10],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  
  // Transition from chart editor back to dashboard
  const editorToDashboardProgress = interpolate(
    frame,
    [SCENE_TIMING.SUCCESS_START - 10, SCENE_TIMING.SUCCESS_START + 10],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  
  // Show toast notification
  const showToast = frame >= SCENE_TIMING.SUCCESS_START + 5;
  
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        width: `calc(100% - ${panelWidth}px)`,
        backgroundColor: "#F8F7F5",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Top Bar */}
      <TopBar
        frame={frame}
        floatOffset={floatOffset}
        title={currentView === "chartEditor" ? "Analytics" : "My Dashboard"}
      />
      
      {/* Navigation bar - shows briefly before chart editor */}
      {frame >= (SCENE_TIMING.LIST_DATASETS_START - 20) && frame < SCENE_TIMING.LIST_DATASETS_START && (
        <div
          style={{
            padding: "16px 24px",
            display: "flex",
            gap: 12,
            borderBottom: "1px solid #E5E0D8",
            backgroundColor: "#FFFFFF",
          }}
        >
          {["Dashboard", "Charts", "Funnels", "Cohorts"].map((tab, index) => {
            const isChartsTab = tab === "Charts";
            const isHighlighted = isChartsTab && navHighlightProgress > 0;
            
            return (
              <div
                key={tab}
                style={{
                  padding: "10px 20px",
                  borderRadius: 8,
                  backgroundColor: isHighlighted
                    ? `rgba(34, 197, 94, ${0.1 * navHighlightProgress})`
                    : index === 0 ? "#F8F7F5" : "transparent",
                  border: isHighlighted
                    ? `2px solid rgba(34, 197, 94, ${navHighlightProgress})`
                    : "2px solid transparent",
                  transform: isHighlighted ? `scale(${1 + 0.05 * navHighlightProgress})` : "scale(1)",
                }}
              >
                <span
                  style={{
                    fontSize: 15,
                    fontWeight: isHighlighted ? 600 : 500,
                    color: isHighlighted ? "#22C55E" : index === 0 ? "#1A1A1A" : "#666666",
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  }}
                >
                  {tab}
                </span>
              </div>
            );
          })}
          
          {/* Create Chart button - highlights during navigation */}
          <div style={{ flex: 1 }} />
          <div
            style={{
              padding: "10px 20px",
              borderRadius: 8,
              backgroundColor: navHighlightProgress > 0.5 ? "#22C55E" : "#F8F7F5",
              border: "1px solid #E5E0D8",
              display: "flex",
              alignItems: "center",
              gap: 8,
              transform: navHighlightProgress > 0.5 ? `scale(${1 + 0.05 * Math.min(1, (navHighlightProgress - 0.5) * 2)})` : "scale(1)",
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke={navHighlightProgress > 0.5 ? "#FFFFFF" : "#666666"}
              strokeWidth="2"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span
              style={{
                fontSize: 15,
                fontWeight: 500,
                color: navHighlightProgress > 0.5 ? "#FFFFFF" : "#666666",
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              }}
            >
              New Chart
            </span>
          </div>
        </div>
      )}
      
      {/* Main content area */}
      <div
        style={{
          flex: 1,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Dashboard view */}
        {(currentView === "dashboard" || currentView === "dashboardWithNewChart") && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              opacity: currentView === "dashboard" ? dashboardToEditorProgress : editorToDashboardProgress,
            }}
          >
            <DashboardGrid
              frame={frame}
              fps={fps}
              showNewChart={currentView === "dashboardWithNewChart"}
              newChartEntranceFrame={SCENE_TIMING.SUCCESS_START + 10}
            />
          </div>
        )}
        
        {/* Chart Editor view */}
        {currentView === "chartEditor" && (
          <ChartEditor
            frame={frame}
            fps={fps}
            entranceFrame={SCENE_TIMING.LIST_DATASETS_START}
          />
        )}
      </div>
      
      {/* Toast notification */}
      {showToast && (
        <ToastNotification
          frame={frame}
          fps={fps}
          entranceFrame={SCENE_TIMING.SUCCESS_START + 5}
          message="Chart added to dashboard"
        />
      )}
    </div>
  );
};
