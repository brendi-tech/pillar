import { AbsoluteFill, spring, interpolate } from "remotion";
import { ReactNode } from "react";

type CameraControllerProps = {
  frame: number;
  fps: number;
  children: ReactNode;
};

// Scene timing constants for dynamic camera
// Rebalanced for smoother step-to-visual synchronization
export const SCENE_TIMING = {
  // Scene 2: Focus on input field
  FOCUS_INPUT_START: 50,
  // Scene 4: Send animation, begin transitioning (longer pause after typing)
  SEND_MESSAGE: 149,
  // Scene 5: Follow search action (wait for zoom-out to complete)
  SEARCH_START: 185,
  // Scene 6: Focus on deal detail (step 2 starts)
  DEAL_DETAIL_START: 220,
  // Scene 7a: Zoom into stage field (before update)
  STAGE_ZOOM_START: 284,
  // Scene 7b: Stage field updates to Closed Won
  STAGE_UPDATE_START: 314,
  // Scene 7c: Zoom out after stage update
  STAGE_ZOOM_OUT: 339,
  // Scene 8: Focus on form
  FORM_START: 364,
  // Scene 10: Success state (response appears while form still shows "Sent!")
  SUCCESS_START: 505,
};

// Camera focus areas (origin percentages)
const CAMERA_STATES = {
  // Scene 1: Full view, centered - static start
  establishing: { scale: 1.0, originX: 50, originY: 50 },
  // Scene 2-3: Dramatic zoom into bottom-right corner (input/chat bubble)
  inputFocus: { scale: 2.0, originX: 100, originY: 100 },
  // Scene 4-5: Zoom out back to full view
  zoomOutBottomRight: { scale: 1.0, originX: 50, originY: 50 },
  // Scene 5+: Full view for search
  searchFocus: { scale: 1.0, originX: 50, originY: 50 },
  // Scene 6: Full view for deal detail
  dealFocus: { scale: 1.0, originX: 50, originY: 50 },
  // Scene 7a: Zoom into Stage field (left column, upper area) - keep left edge visible
  stageZoomIn: { scale: 2.1, originX: 0, originY: 45 },
  // Scene 7c: After stage update, zoom back out
  stageZoomOut: { scale: 1.0, originX: 50, originY: 50 },
  // Scene 8-9: Full view for form modal
  formFocus: { scale: 1.0, originX: 50, originY: 50 },
  // Scene 10-12: Full view for success
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

  // Timing for origin transition (after zoom-out completes)
  const ORIGIN_TRANSITION_START = SCENE_TIMING.SEARCH_START + 30; // Give 1 second after search starts

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
  } else if (frame < SCENE_TIMING.SEARCH_START) {
    // Scene 4: Zoom out but keep origin at bottom-right (no drift)
    currentState = CAMERA_STATES.inputFocus;
    targetState = CAMERA_STATES.zoomOutBottomRight;
    transitionProgress = spring({
      frame: frame - SCENE_TIMING.SEND_MESSAGE,
      fps,
      config: { damping: 200 },
    });
  } else if (frame < ORIGIN_TRANSITION_START) {
    // Hold at bottom-right origin while search happens
    currentState = CAMERA_STATES.zoomOutBottomRight;
    targetState = CAMERA_STATES.zoomOutBottomRight;
    transitionProgress = 1;
  } else if (frame < SCENE_TIMING.DEAL_DETAIL_START) {
    // Transition origin to center for deal detail
    currentState = CAMERA_STATES.zoomOutBottomRight;
    targetState = CAMERA_STATES.dealFocus;
    transitionProgress = spring({
      frame: frame - ORIGIN_TRANSITION_START,
      fps,
      config: { damping: 200 },
    });
  } else if (frame < SCENE_TIMING.STAGE_ZOOM_START) {
    // Scene 6: Hold on deal detail view
    currentState = CAMERA_STATES.dealFocus;
    targetState = CAMERA_STATES.dealFocus;
    transitionProgress = 1;
  } else if (frame < SCENE_TIMING.STAGE_UPDATE_START) {
    // Scene 7a: Zoom into Stage field (before update)
    currentState = CAMERA_STATES.dealFocus;
    targetState = CAMERA_STATES.stageZoomIn;
    transitionProgress = spring({
      frame: frame - SCENE_TIMING.STAGE_ZOOM_START,
      fps,
      config: { damping: 18, stiffness: 100 }, // Smooth zoom in
    });
  } else if (frame < SCENE_TIMING.STAGE_ZOOM_OUT) {
    // Scene 7b: Hold zoom on Stage field during the "Closed Won" transition
    currentState = CAMERA_STATES.stageZoomIn;
    targetState = CAMERA_STATES.stageZoomIn;
    transitionProgress = 1;
  } else if (frame < SCENE_TIMING.FORM_START) {
    // Scene 7c: Zoom out from Stage field
    currentState = CAMERA_STATES.stageZoomIn;
    targetState = CAMERA_STATES.stageZoomOut;
    transitionProgress = spring({
      frame: frame - SCENE_TIMING.STAGE_ZOOM_OUT,
      fps,
      config: { damping: 20, stiffness: 80 }, // Smooth zoom out
    });
  } else if (frame < SCENE_TIMING.SUCCESS_START) {
    // Scene 8-9: Focus on form
    currentState = CAMERA_STATES.formFocus;
    targetState = CAMERA_STATES.formFocus;
    transitionProgress = 1;
  } else {
    // Scene 10-12: Pull back
    currentState = CAMERA_STATES.formFocus;
    targetState = CAMERA_STATES.successView;
    transitionProgress = spring({
      frame: frame - SCENE_TIMING.SUCCESS_START,
      fps,
      config: { damping: 200 },
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
