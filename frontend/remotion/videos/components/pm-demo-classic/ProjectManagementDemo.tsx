import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import type { ProjectManagementDemoProps } from "./Root";
import { DIMENSIONS } from "./Root";
import { LinearBackground } from "./components/LinearBackground";
import { CoPilotPanel } from "./components/CoPilotPanel";
import { CameraController, SCENE_TIMING } from "./components/CameraController";
import { IssueModal } from "./components/IssueModal";
import { ToastNotification } from "./components/ToastNotification";
import { PillarLogoOverlay } from "./components/PillarLogoOverlay";

// Intro/Outro timing
const INTRO_END = 8; // 0.25 second intro with Pillar logo (quick fade)
const OUTRO_START = 510; // Start fade for outro
const TOTAL_FRAMES = 540; // 18 seconds

export const ProjectManagementDemo = ({
  query,
  responseText,
  steps,
  layout,
  issueId,
  contextSnippet,
}: ProjectManagementDemoProps) => {
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

  // UI opacity: only fade out before outro (logo overlays on top for intro, no delay)
  const uiOpacity = interpolate(
    frame,
    [OUTRO_START, OUTRO_START + 8],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Subtle parallax float animation for organic feel
  const floatOffset = Math.sin(frame / 30) * 3;

  // Very subtle background dim during input focus (Scene 2-4)
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

  // Show issue modal after form opens (Scene 5+)
  const showIssueModal = frame >= SCENE_TIMING.OPEN_FORM && frame < SCENE_TIMING.SUCCESS;

  // Show toast after success
  const showToast = frame >= SCENE_TIMING.SUCCESS;

  // Calculate if new issue should be visible in the list
  const showNewIssue = frame >= SCENE_TIMING.SUCCESS;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#F8F7F5",
      }}
    >
      {/* Main UI content - fades in after intro, fades out before outro */}
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
            {/* Linear Background - very subtle dim only, no blur */}
            <div
              style={{
                opacity: backgroundDim,
                transition: "none",
              }}
            >
              <LinearBackground
                frame={frame}
                fps={fps}
                floatOffset={floatOffset}
                panelWidth={DIMENSIONS.panelPixelWidth}
                showNewIssue={showNewIssue}
                issueId={issueId}
              />
            </div>

            {/* Issue Modal - rendered outside dim wrapper for proper stacking */}
            {showIssueModal && (
              <IssueModal
                frame={frame}
                fps={fps}
                entranceFrame={SCENE_TIMING.OPEN_FORM}
                panelWidth={DIMENSIONS.panelPixelWidth}
              />
            )}

            {/* Toast Notification */}
            {showToast && (
              <ToastNotification
                frame={frame}
                fps={fps}
                entranceFrame={SCENE_TIMING.SUCCESS}
                issueId={issueId}
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
              contextSnippet={contextSnippet}
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
