import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import { BankingDashboard } from "./BankingDashboard";
import { PaymentScreen } from "./PaymentScreen";
import { ConfirmationModal } from "./ConfirmationModal";
import { CoPilotPanel } from "./CoPilotPanel";
import { CameraController, SCENE_TIMING } from "./CameraController";
import { PillarLogoOverlay } from "./PillarLogoOverlay";

export type Step = {
  text: string;
  techBadge?: string;
};

export type Layout = {
  contentWidth: number;
  panelWidth: number;
};

export type BankingDemoClassicProps = {
  query: string;
  responseText: string;
  steps: Step[];
  layout: Layout;
  accentColor: string;
  showLogos?: boolean;
};

// Layout constants - 65/35 split
export const LAYOUT = {
  contentWidth: 0.65,
  panelWidth: 0.35,
};

export const DIMENSIONS = {
  width: 1920,
  height: 1080,
  contentPixelWidth: 1920 * LAYOUT.contentWidth,
  panelPixelWidth: 1920 * LAYOUT.panelWidth,
};

// Intro/Outro timing
const INTRO_END = 8; // 0.25 second intro with Pillar logo (quick fade)
const OUTRO_START = 790; // Start fade for loop transition
const TOTAL_FRAMES = 840; // 28 seconds

export const BankingDemoClassic = ({ query, responseText, steps, layout, accentColor, showLogos = true }: BankingDemoClassicProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Scene 1: Establishing Shot (frames 0-60)
  // UI starts visible with a subtle scale-up entrance over first ~30 frames
  const entrance = spring({
    frame,
    fps,
    config: { damping: 20, stiffness: 100 },
  });

  // Start at 98% scale and grow to 100% - subtle "pop in" effect
  const entranceScale = interpolate(entrance, [0, 1], [0.98, 1]);
  
  // UI opacity: fade out before outro only when logos are shown
  const uiOpacity = showLogos
    ? interpolate(
        frame,
        [OUTRO_START, OUTRO_START + 8],
        [1, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
      )
    : 1;

  // Subtle parallax float animation for organic feel
  const floatOffset = Math.sin(frame / 30) * 3;

  // Background dim during input focus (Scene 2-3)
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
    // Strong dim during input focus (0.4 = 60% dimmed)
    backgroundDim = interpolate(dimProgress, [0, 1], [1, 0.4], {
      extrapolateRight: "clamp",
    });
  } else if (frame >= SCENE_TIMING.SEND_MESSAGE) {
    // Fade back in
    backgroundDim = interpolate(dimOutProgress, [0, 1], [0.4, 1], {
      extrapolateRight: "clamp",
    });
  }

  // Determine which view to show: dashboard or payment screen
  const showPaymentScreen = frame >= SCENE_TIMING.NAVIGATE_PAYMENT;
  
  // Dashboard to Payment screen transition
  const dashboardOpacity = interpolate(
    frame,
    [SCENE_TIMING.NAVIGATE_PAYMENT - 10, SCENE_TIMING.NAVIGATE_PAYMENT + 10],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  
  const paymentOpacity = interpolate(
    frame,
    [SCENE_TIMING.NAVIGATE_PAYMENT - 10, SCENE_TIMING.NAVIGATE_PAYMENT + 20],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Confirmation modal visibility
  const showModal = frame >= SCENE_TIMING.MODAL_OPEN;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#F8FAFC", // Light gray-blue for banking
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
            {/* Banking Content - with dim effect */}
            <div
              style={{
                opacity: backgroundDim,
                transition: "none",
              }}
            >
              {/* Dashboard View */}
              <div style={{ opacity: dashboardOpacity, transition: "none" }}>
                <BankingDashboard
                  frame={frame}
                  fps={fps}
                  floatOffset={floatOffset}
                  panelWidth={DIMENSIONS.panelPixelWidth}
                  accentColor={accentColor}
                />
              </div>

              {/* Payment Screen View */}
              {showPaymentScreen && (
                <div style={{ opacity: paymentOpacity, transition: "none" }}>
                  <PaymentScreen
                    frame={frame}
                    fps={fps}
                    floatOffset={floatOffset}
                    panelWidth={DIMENSIONS.panelPixelWidth}
                    accentColor={accentColor}
                  />
                </div>
              )}
            </div>

            {/* Confirmation Modal - rendered outside dim wrapper */}
            {showModal && (
              <ConfirmationModal
                frame={frame}
                fps={fps}
                entranceFrame={SCENE_TIMING.MODAL_OPEN}
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
              accentColor={accentColor}
            />
          </CameraController>
        </AbsoluteFill>
      </AbsoluteFill>

      {showLogos && (
        <>
          <PillarLogoOverlay
            frame={frame}
            fps={fps}
            type="intro"
            introEnd={INTRO_END}
            outroStart={OUTRO_START}
            totalFrames={TOTAL_FRAMES}
          />
          <PillarLogoOverlay
            frame={frame}
            fps={fps}
            type="outro"
            introEnd={INTRO_END}
            outroStart={OUTRO_START}
            totalFrames={TOTAL_FRAMES}
          />
        </>
      )}
    </AbsoluteFill>
  );
};
