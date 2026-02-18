import { AbsoluteFill, spring, interpolate } from "remotion";
import { ReactNode } from "react";

type CameraControllerProps = {
  frame: number;
  fps: number;
  children: ReactNode;
};

// Scene timing constants for PM demo
// Aligned with the storyboard frame-by-frame breakdown
export const SCENE_TIMING = {
  // Intro/Outro
  INTRO_END: 8,
  OUTRO_START: 510,
  TOTAL_FRAMES: 540,

  // Scene 1: Establishing shot
  ESTABLISHING_END: 60,

  // Scene 2: Focus on input field
  FOCUS_INPUT_START: 60,

  // Scene 3: Typing query
  TYPING_START: 105,

  // Scene 4: Send animation + first step
  SEND_MESSAGE: 180,

  // Scene 5: Camera follows issue form open (SLOWER - more time for MCP back-and-forth)
  OPEN_FORM: 250,  // Was 204 - now 70 frames later (2.3 seconds after send)

  // NEW ORDER: Title first, then Type, Priority, Cycle
  // Scene 6: Pre-fill title (immediately after form opens)
  PREFILL_TITLE: 260,

  // Scene 7: Set type to Bug
  SET_TYPE: 310,

  // Scene 8: Set priority to P1
  SET_PRIORITY: 360,

  // Scene 9: Add to current cycle
  ADD_TO_CYCLE: 400,

  // Scene 10: Success + Response
  SUCCESS: 450,

  // Scene 11: Hold
  HOLD: 465,

  // Scene 12: Loop transition
  LOOP_TRANSITION: 510,
};

// Camera focus areas (origin percentages)
const CAMERA_STATES = {
  // Scene 1: Full view, centered - static start
  establishing: { scale: 1.0, originX: 50, originY: 50 },

  // Scene 2-3: Dramatic zoom into bottom-right corner (input/chat bubble)
  inputFocus: { scale: 2.0, originX: 100, originY: 100 },

  // Scene 4: Zoom out back to full view briefly
  zoomOutBottomRight: { scale: 1.0, originX: 50, originY: 50 },

  // Scene 5-9: Consistent zoom for entire modal interaction
  // Center on modal (left side of screen, ~22% from left, 55% from top to show dropdown space)
  modalZoom: { scale: 1.8, originX: 22, originY: 55 },

  // Scene 10-12: Success view - zoom out
  successView: { scale: 1.0, originX: 50, originY: 50 },
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
  } else if (frame < SCENE_TIMING.OPEN_FORM) {
    // Scene 4: Zoom out after send, then prepare for modal
    currentState = CAMERA_STATES.inputFocus;
    targetState = CAMERA_STATES.zoomOutBottomRight;
    transitionProgress = spring({
      frame: frame - SCENE_TIMING.SEND_MESSAGE,
      fps,
      config: { damping: 200 },
    });
  } else if (frame < SCENE_TIMING.SUCCESS) {
    // Scene 5-9: Zoom into modal and STAY zoomed for entire modal interaction
    const modalTransitionDuration = 30; // 1 second to zoom in
    
    if (frame < SCENE_TIMING.OPEN_FORM + modalTransitionDuration) {
      // Transitioning into modal zoom
      currentState = CAMERA_STATES.zoomOutBottomRight;
      targetState = CAMERA_STATES.modalZoom;
      transitionProgress = spring({
        frame: frame - SCENE_TIMING.OPEN_FORM,
        fps,
        config: { damping: 30, stiffness: 80 },
      });
    } else {
      // Hold at modal zoom for all form interactions
      currentState = CAMERA_STATES.modalZoom;
      targetState = CAMERA_STATES.modalZoom;
      transitionProgress = 1;
    }
  } else {
    // Scene 10-12: Zoom out to success view
    currentState = CAMERA_STATES.modalZoom;
    targetState = CAMERA_STATES.successView;
    transitionProgress = spring({
      frame: frame - SCENE_TIMING.SUCCESS,
      fps,
      config: { damping: 20, stiffness: 80 },
    });
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
