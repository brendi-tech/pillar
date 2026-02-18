import { AbsoluteFill, spring, interpolate } from "remotion";
import { ReactNode } from "react";

type CameraControllerProps = {
  frame: number;
  fps: number;
  children: ReactNode;
};

// Scene timing constants for Analytics demo
export const SCENE_TIMING = {
  // Scene 2: Focus on input field
  FOCUS_INPUT_START: 60,
  // Scene 4: Send animation
  SEND_MESSAGE: 180,
  // Scene 5: List data sets
  LIST_DATASETS_START: 204,
  // Scene 6: Get data set
  GET_DATASET_START: 240,
  // Scene 7: Writing SQL query
  WRITING_SQL_START: 270,
  // Scene 8: Inputting SQL query (typing animation)
  INPUT_SQL_START: 300,
  INPUT_SQL_END: 360,
  // Scene 9: Previewing results
  PREVIEW_START: 360,
  PREVIEW_END: 405,
  // Scene 10: Saving dashboard
  SAVE_DASHBOARD_START: 405,
  // Scene 11: Success state
  SUCCESS_START: 435,
  // Scene 12: Outro
  OUTRO_START: 510,
};

// Camera focus areas (origin percentages)
// Simplified: no zoom during SQL editing, only zoom for input focus
const CAMERA_STATES = {
  // Scene 1: Full view, centered
  establishing: { scale: 1.0, originX: 50, originY: 50 },
  // Scene 2-3: Dramatic zoom into bottom-right corner (input field)
  inputFocus: { scale: 2.0, originX: 100, originY: 100 },
  // Scene 4+: Full view for all SQL editing scenes
  default: { scale: 1.0, originX: 50, originY: 50 },
};

export const CameraController = ({
  frame,
  fps,
  children,
}: CameraControllerProps) => {
  let currentState = CAMERA_STATES.establishing;
  let targetState = CAMERA_STATES.establishing;
  let transitionProgress = 1;

  if (frame < SCENE_TIMING.FOCUS_INPUT_START) {
    // Scene 1: Establishing shot
    currentState = CAMERA_STATES.establishing;
    targetState = CAMERA_STATES.establishing;
  } else if (frame < SCENE_TIMING.SEND_MESSAGE) {
    // Scene 2-3: Zooming in to input field
    currentState = CAMERA_STATES.establishing;
    targetState = CAMERA_STATES.inputFocus;
    transitionProgress = spring({
      frame: frame - SCENE_TIMING.FOCUS_INPUT_START,
      fps,
      config: { damping: 30, stiffness: 80 },
    });
  } else if (frame < SCENE_TIMING.LIST_DATASETS_START) {
    // Scene 4: Zoom out
    currentState = CAMERA_STATES.inputFocus;
    targetState = CAMERA_STATES.default;
    transitionProgress = spring({
      frame: frame - SCENE_TIMING.SEND_MESSAGE,
      fps,
      config: { damping: 200 },
    });
  } else {
    // Scenes 5-12: Stay at default view (no zoom during SQL editing)
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
