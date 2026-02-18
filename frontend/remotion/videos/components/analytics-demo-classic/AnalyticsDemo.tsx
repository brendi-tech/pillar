import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import type { AnalyticsDemoProps } from "./Root";
import { DIMENSIONS } from "./Root";
import { AnalyticsContent } from "./components/AnalyticsContent";
import { CoPilotPanel } from "./components/CoPilotPanel";
import { CameraController, SCENE_TIMING } from "./components/CameraController";
import { PillarLogoOverlay } from "./components/PillarLogoOverlay";

// Intro/Outro timing
const INTRO_END = 8; // 0.25 second intro with Pillar logo
const OUTRO_START = 510; // Start fade for outro
const TOTAL_FRAMES = 540;

export const AnalyticsDemo = ({ query, responseText, steps, layout }: AnalyticsDemoProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Scene 1: Establishing Shot - subtle scale-up entrance
  const entrance = spring({
    frame,
    fps,
    config: { damping: 20, stiffness: 100 },
  });

  const entranceScale = interpolate(entrance, [0, 1], [0.98, 1]);
  
  // UI opacity: fade out before outro
  const uiOpacity = interpolate(
    frame,
    [OUTRO_START, OUTRO_START + 8],
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

  // Calculate background dim during typing (0.4 = 60% dimmed)
  let backgroundDim = 1;

  if (frame >= SCENE_TIMING.FOCUS_INPUT_START && frame < SCENE_TIMING.SEND_MESSAGE) {
    backgroundDim = interpolate(dimProgress, [0, 1], [1, 0.4], {
      extrapolateRight: "clamp",
    });
  } else if (frame >= SCENE_TIMING.SEND_MESSAGE) {
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
      {/* Main UI content */}
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
            {/* Analytics Content - with dim during typing */}
            <div
              style={{
                opacity: backgroundDim,
                transition: "none",
              }}
            >
              <AnalyticsContent
                frame={frame}
                fps={fps}
                floatOffset={floatOffset}
                panelWidth={DIMENSIONS.panelPixelWidth}
              />
            </div>

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
