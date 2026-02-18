import { interpolate } from "remotion";
import { ChartWidget } from "./ChartWidget";

type DashboardGridProps = {
  frame: number;
  fps: number;
  showNewChart: boolean;
  newChartEntranceFrame: number;
};

export const DashboardGrid = ({
  frame,
  fps,
  showNewChart,
  newChartEntranceFrame,
}: DashboardGridProps) => {
  // Subtle float animation
  const floatOffset = Math.sin(frame / 30) * 2;
  
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, 1fr)",
        gap: 24,
        padding: 32,
        transform: `translateY(${floatOffset}px)`,
      }}
    >
      {/* Existing chart widgets */}
      <ChartWidget
        frame={frame}
        fps={fps}
        title="Monthly Revenue"
        value="$124,500"
        change="12.5%"
        changePositive={true}
        entranceFrame={0}
        chartColor="#3B82F6"
      />
      
      <ChartWidget
        frame={frame}
        fps={fps}
        title="Active Users"
        value="8,432"
        change="8.2%"
        changePositive={true}
        entranceFrame={0}
        chartColor="#8B5CF6"
      />
      
      {/* New signups chart - appears at the end */}
      {showNewChart ? (
        <ChartWidget
          frame={frame}
          fps={fps}
          title="Weekly Signups"
          value="1,247"
          change="15.3%"
          changePositive={true}
          isNew={true}
          entranceFrame={newChartEntranceFrame}
          chartColor="#22C55E"
        />
      ) : (
        // Empty slot placeholder
        <div
          style={{
            backgroundColor: "#F8F7F5",
            borderRadius: 16,
            border: "2px dashed #E5E0D8",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 180,
            opacity: interpolate(frame, [0, 30], [0, 0.6], {
              extrapolateRight: "clamp",
            }),
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                backgroundColor: "#E5E0D8",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span style={{ fontSize: 24, color: "#999999" }}>+</span>
            </div>
            <span
              style={{
                fontSize: 14,
                color: "#999999",
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              }}
            >
              Add chart
            </span>
          </div>
        </div>
      )}
      
      <ChartWidget
        frame={frame}
        fps={fps}
        title="Page Views"
        value="45.2K"
        change="5.1%"
        changePositive={true}
        entranceFrame={0}
        chartColor="#F59E0B"
      />
    </div>
  );
};
