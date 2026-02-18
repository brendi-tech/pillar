import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import type { HRDemoProps } from "./Root";
import { DIMENSIONS } from "./Root";
import { HRBackground } from "./components/HRBackground";
import { CoPilotPanel } from "./components/CoPilotPanel";
import { CameraController, SCENE_TIMING } from "./components/CameraController";
import { EditDepositModal } from "./components/EditDepositModal";
import { PillarLogoOverlay } from "./components/PillarLogoOverlay";

// Intro/Outro timing
const INTRO_END = 8; // 0.25 second intro with Pillar logo (quick fade)
const OUTRO_START = 460; // Start fade for loop transition
const TOTAL_FRAMES = 495; // 16.5 seconds at 30fps

export const HRDemo = ({ query, responseText, steps, layout }: HRDemoProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Scene 1: Establishing Shot (frames 0-60)
  // UI starts visible with a subtle scale-up entrance over first ~30 frames (1 second)
  const entrance = spring({
    frame,
    fps,
    config: { damping: 20, stiffness: 100 },
  });

  // Start at 98% scale and grow to 100% - subtle "pop in" effect
  const entranceScale = interpolate(entrance, [0, 1], [0.98, 1]);

  // UI opacity: fade out before outro for loop transition
  const uiOpacity = interpolate(
    frame,
    [OUTRO_START, OUTRO_START + 15],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Subtle parallax float animation for organic feel
  const floatOffset = Math.sin(frame / 30) * 3;

  // Background dim during input focus (Scene 2-4)
  const dimProgress = spring({
    frame: Math.max(0, frame - SCENE_TIMING.FOCUS_INPUT_START),
    fps,
    config: { damping: 200 },
  });

  const dimOutProgress = spring({
    frame: Math.max(0, frame - SCENE_TIMING.SEND_MESSAGE),
    fps,
    config: { damping: 200 },
  });

  // Calculate strong dim during typing (grayed out left side)
  let backgroundDim = 1;

  if (frame >= SCENE_TIMING.FOCUS_INPUT_START && frame < SCENE_TIMING.SEND_MESSAGE) {
    // Strong dim during input focus (0.4 = 60% dimmed, very grayed out)
    backgroundDim = interpolate(dimProgress, [0, 1], [1, 0.4], {
      extrapolateRight: "clamp",
    });
  } else if (frame >= SCENE_TIMING.SEND_MESSAGE) {
    // Fade back in
    backgroundDim = interpolate(dimOutProgress, [0, 1], [0.4, 1], {
      extrapolateRight: "clamp",
    });
  }

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#F8F7F5",
      }}
    >
      {/* Main UI content - fades out before outro */}
      <AbsoluteFill
        style={{
          opacity: uiOpacity,
        }}
      >
        {/* Subtle entrance scale animation */}
        <AbsoluteFill
          style={{
            transform: `scale(${entranceScale})`,
            transformOrigin: "center center",
          }}
        >
          <CameraController frame={frame} fps={fps}>
            {/* HR Dashboard Background - very subtle dim only, no blur */}
            <div
              style={{
                opacity: backgroundDim,
                transition: "none",
              }}
            >
              <HRBackground
                frame={frame}
                fps={fps}
                floatOffset={floatOffset}
                panelWidth={DIMENSIONS.panelPixelWidth}
              />
            </div>

            {/* Edit Deposit Modal - rendered outside dim wrapper for proper stacking */}
            {frame >= SCENE_TIMING.FORM_START && (
              <EditDepositModal
                frame={frame}
                fps={fps}
                visible={true}
                entranceFrame={SCENE_TIMING.FORM_START}
                panelWidth={DIMENSIONS.panelPixelWidth}
              />
            )}

            {/* Co-pilot Panel on the right - always at full opacity */}
            <CoPilotPanel
              frame={frame}
              fps={fps}
              query={query}
              responseText={responseText}
              steps={steps}
              floatOffset={floatOffset}
              panelWidth={DIMENSIONS.panelPixelWidth}
            />
          </CameraController>
        </AbsoluteFill>
      </AbsoluteFill>

      {/* Intro Pillar logo overlay */}
      <PillarLogoOverlay
        frame={frame}
        fps={fps}
        type="intro"
        introEnd={INTRO_END}
        outroStart={OUTRO_START}
        totalFrames={TOTAL_FRAMES}
      />

      {/* Outro Pillar logo overlay */}
      <PillarLogoOverlay
        frame={frame}
        fps={fps}
        type="outro"
        introEnd={INTRO_END}
        outroStart={OUTRO_START}
        totalFrames={TOTAL_FRAMES}
      />
    </AbsoluteFill>
  );
};
