import { AbsoluteFill, spring, interpolate } from "remotion";
import { ReactNode } from "react";

type CameraControllerProps = {
  frame: number;
  fps: number;
  children: ReactNode;
};

// Scene timing constants for dynamic camera - adapted for HR demo (495 frames total)
export const SCENE_TIMING = {
  // Scene 2: Focus on input field (start zoom)
  FOCUS_INPUT_START: 60,
  // Scene 4: Send animation begins
  SEND_MESSAGE: 165,
  // Scene 5: Navigate to Payroll settings
  NAVIGATE_TO_PAYROLL: 189,
  // Scene 6: Open Direct Deposit section
  OPEN_SECTION: 225,
  // Scene 7: Edit form opens
  FORM_START: 270,
  // Scene 8: Ready state with guidance
  READY_STATE: 315,
  // Scene 9: Response appears
  RESPONSE_START: 360,
  // Scene 10: Hold
  HOLD_START: 405,
  // Scene 11: Loop transition
  LOOP_START: 465,
};

// Camera focus areas (origin percentages)
const CAMERA_STATES = {
  // Scene 1: Full view, centered - static start
  establishing: { scale: 1.0, originX: 50, originY: 50 },
  // Scene 2-3: Dramatic zoom into bottom-right corner (input/chat bubble)
  inputFocus: { scale: 2.0, originX: 100, originY: 100 },
  // Scene 4-5: Zoom out back to full view
  zoomOutBottomRight: { scale: 1.0, originX: 50, originY: 50 },
  // Scene 5+: Full view for navigation
  navigationFocus: { scale: 1.0, originX: 50, originY: 50 },
  // Scene 6: Full view for section
  sectionFocus: { scale: 1.0, originX: 50, originY: 50 },
  // Scene 7: Zoom into form modal (moderate zoom to show full form including buttons)
  formZoom: { scale: 1.4, originX: 30, originY: 50 },
  // Scene 8+: Zoom out for ready state
  readyState: { scale: 1.0, originX: 50, originY: 50 },
  // Scene 10-11: Full view
  holdView: { scale: 1.0, originX: 50, originY: 50 },
};

export const CameraController = ({
  frame,
  fps,
  children,
}: CameraControllerProps) => {
  // Determine which camera state we're in and transitioning to
  let currentState = CAMERA_STATES.establishing;
  let targetState = CAMERA_STATES.establishing;
  let transitionProgress = 1;

  // Timing for origin transition (after zoom-out completes)
  const ORIGIN_TRANSITION_START = SCENE_TIMING.NAVIGATE_TO_PAYROLL + 20;

  if (frame < SCENE_TIMING.FOCUS_INPUT_START) {
    // Scene 1: Establishing shot
    currentState = CAMERA_STATES.establishing;
    targetState = CAMERA_STATES.establishing;
  } else if (frame < SCENE_TIMING.SEND_MESSAGE) {
    // Scene 2-3: Zooming in to input field - smooth transition
    currentState = CAMERA_STATES.establishing;
    targetState = CAMERA_STATES.inputFocus;
    transitionProgress = spring({
      frame: frame - SCENE_TIMING.FOCUS_INPUT_START,
      fps,
      config: { damping: 30, stiffness: 80 }, // Smoother, slower zoom
    });
  } else if (frame < SCENE_TIMING.NAVIGATE_TO_PAYROLL) {
    // Scene 4: Zoom out but keep origin at bottom-right initially
    currentState = CAMERA_STATES.inputFocus;
    targetState = CAMERA_STATES.zoomOutBottomRight;
    transitionProgress = spring({
      frame: frame - SCENE_TIMING.SEND_MESSAGE,
      fps,
      config: { damping: 200 },
    });
  } else if (frame < ORIGIN_TRANSITION_START) {
    // Hold at full view while navigation happens
    currentState = CAMERA_STATES.zoomOutBottomRight;
    targetState = CAMERA_STATES.zoomOutBottomRight;
    transitionProgress = 1;
  } else if (frame < SCENE_TIMING.OPEN_SECTION) {
    // Transition origin to center for section view
    currentState = CAMERA_STATES.zoomOutBottomRight;
    targetState = CAMERA_STATES.sectionFocus;
    transitionProgress = spring({
      frame: frame - ORIGIN_TRANSITION_START,
      fps,
      config: { damping: 200 },
    });
  } else if (frame < SCENE_TIMING.FORM_START) {
    // Scene 6: Hold on section view
    currentState = CAMERA_STATES.sectionFocus;
    targetState = CAMERA_STATES.sectionFocus;
    transitionProgress = 1;
  } else if (frame < SCENE_TIMING.READY_STATE) {
    // Scene 7: Zoom into form modal
    currentState = CAMERA_STATES.sectionFocus;
    targetState = CAMERA_STATES.formZoom;
    transitionProgress = spring({
      frame: frame - SCENE_TIMING.FORM_START,
      fps,
      config: { damping: 18, stiffness: 100 }, // Smooth zoom in
    });
  } else if (frame < SCENE_TIMING.RESPONSE_START) {
    // Scene 8: Hold zoom on form during ready state
    currentState = CAMERA_STATES.formZoom;
    targetState = CAMERA_STATES.formZoom;
    transitionProgress = 1;
  } else if (frame < SCENE_TIMING.HOLD_START) {
    // Scene 9: Zoom out for response
    currentState = CAMERA_STATES.formZoom;
    targetState = CAMERA_STATES.readyState;
    transitionProgress = spring({
      frame: frame - SCENE_TIMING.RESPONSE_START,
      fps,
      config: { damping: 20, stiffness: 80 }, // Smooth zoom out
    });
  } else {
    // Scene 10-11: Hold at full view
    currentState = CAMERA_STATES.holdView;
    targetState = CAMERA_STATES.holdView;
    transitionProgress = 1;
  }

  // Interpolate between states
  const scale = interpolate(
    transitionProgress,
    [0, 1],
    [currentState.scale, targetState.scale]
  );

  const originX = interpolate(
    transitionProgress,
    [0, 1],
    [currentState.originX, targetState.originX]
  );

  const originY = interpolate(
    transitionProgress,
    [0, 1],
    [currentState.originY, targetState.originY]
  );

  return (
    <AbsoluteFill
      style={{
        transform: `scale(${scale})`,
        transformOrigin: `${originX}% ${originY}%`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};
