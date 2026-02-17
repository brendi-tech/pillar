import { AbsoluteFill, spring, interpolate } from "remotion";
import { ReactNode } from "react";

type CameraControllerProps = {
  frame: number;
  fps: number;
  children: ReactNode;
};

// Scene timing constants for banking demo (launch video pacing)
export const SCENE_TIMING = {
  // Scene 1-2: Establishing shot + focus input (frames 0-60)
  FOCUS_INPUT_START: 60,
  // Scene 3: Typing the query (frames 60-180)
  TYPING_START: 60,
  // Scene 4: Send animation (frame 180)
  SEND_MESSAGE: 180,
  // Scene 5: Steps appear one by one (frames 200-510)
  RECIPIENT_CARD_SHOW: 200,
  // Scene 6: Navigate to payment screen (frame 360)
  NAVIGATE_PAYMENT: 360,
  // Scene 7: Pre-fill highlight effect (frame 400)
  PREFILL_DATA: 400,
  // Scene 8: Confirmation modal opens (frame 530)
  MODAL_OPEN: 530,
  // Scene 9: User presses confirm (frame 600)
  CONFIRM_PRESS: 600,
  // Scene 10: 2FA screen appears (frame 630)
  TWO_FA_SHOW: 630,
  // Scene 11: 2FA code entered, success (frame 710)
  TWO_FA_COMPLETE: 710,
  // Scene 12: Hold on final state (frames 740-790)
  HOLD_START: 740,
  // Scene 13: Outro/loop transition (frames 790-840)
  OUTRO_START: 790,
};

// Camera focus areas (origin percentages)
const CAMERA_STATES = {
  // Scene 1: Full view, centered - establishing shot
  establishing: { scale: 1.0, originX: 50, originY: 50 },
  // Scene 2-3: Dramatic zoom into input field (bottom-right corner of panel)
  inputFocus: { scale: 2.0, originX: 100, originY: 100 },
  // Scene 4-5: Zoom back out to full view
  zoomOut: { scale: 1.0, originX: 50, originY: 50 },
  // Scene 6+: Zoom on payment form (left edge, X=0 to keep form visible)
  formFocus: { scale: 1.3, originX: 0, originY: 40 },
  // Default: Full view centered
  default: { scale: 1.0, originX: 50, originY: 50 },
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
    // Scene 1: Establishing shot - static
    currentState = CAMERA_STATES.establishing;
    targetState = CAMERA_STATES.establishing;
  } else if (frame < SCENE_TIMING.SEND_MESSAGE) {
    // Scene 2-3: Zooming in to input field
    currentState = CAMERA_STATES.establishing;
    targetState = CAMERA_STATES.inputFocus;
    transitionProgress = spring({
      frame: frame - SCENE_TIMING.FOCUS_INPUT_START,
      fps,
      config: { damping: 30, stiffness: 80 }, // Smooth zoom in
    });
  } else if (frame < SCENE_TIMING.RECIPIENT_CARD_SHOW) {
    // Scene 4: Zoom back out after sending
    currentState = CAMERA_STATES.inputFocus;
    targetState = CAMERA_STATES.zoomOut;
    transitionProgress = spring({
      frame: frame - SCENE_TIMING.SEND_MESSAGE,
      fps,
      config: { damping: 200 }, // Quick zoom out
    });
  } else {
    // Scene 5+: Stay at full view for the rest of the demo
    currentState = CAMERA_STATES.default;
    targetState = CAMERA_STATES.default;
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
