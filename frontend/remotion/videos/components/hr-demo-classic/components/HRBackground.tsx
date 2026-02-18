import { interpolate } from "remotion";
import { HomeDashboard } from "./HomeDashboard";
import { PayrollSettings } from "./PayrollSettings";
import { SCENE_TIMING } from "./CameraController";

type HRBackgroundProps = {
  frame: number;
  fps: number;
  floatOffset: number;
  panelWidth: number;
};

export const HRBackground = ({
  frame,
  fps,
  floatOffset,
  panelWidth,
}: HRBackgroundProps) => {
  // Calculate view transitions
  const showPayroll = frame >= SCENE_TIMING.NAVIGATE_TO_PAYROLL;

  // Cross-fade between Home Dashboard and Payroll Settings
  const dashboardOpacity = interpolate(
    frame,
    [SCENE_TIMING.NAVIGATE_TO_PAYROLL - 10, SCENE_TIMING.NAVIGATE_TO_PAYROLL + 10],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const payrollOpacity = interpolate(
    frame,
    [SCENE_TIMING.NAVIGATE_TO_PAYROLL - 5, SCENE_TIMING.NAVIGATE_TO_PAYROLL + 15],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: panelWidth,
        bottom: 0,
        overflow: "hidden",
      }}
    >
      {/* Home Dashboard - fades out when navigating to Payroll */}
      {!showPayroll && (
        <HomeDashboard
          frame={frame}
          fps={fps}
          floatOffset={floatOffset}
          opacity={dashboardOpacity}
        />
      )}

      {/* Payroll Settings - fades in when navigating */}
      {showPayroll && (
        <PayrollSettings
          frame={frame}
          fps={fps}
          floatOffset={floatOffset}
          opacity={payrollOpacity}
        />
      )}
    </div>
  );
};
