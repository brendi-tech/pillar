import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
const FONT =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
const MONO_FONT =
  '"SF Mono", "Fira Code", "Fira Mono", "Roboto Mono", monospace';
import {
  SCENES,
  PROMPT_TEXT,
  API_KEY,
  COLORS,
  SECRET_REVEAL_DIMENSIONS,
  SECRET_REVEAL_DURATION,
} from "./constants";

export { SECRET_REVEAL_DIMENSIONS, SECRET_REVEAL_DURATION };

// ---------------------------------------------------------------------------
// Pillar Logo SVG (from codebase)
// ---------------------------------------------------------------------------

const PillarLogoWithName = ({ width = 297 }: { width?: number }) => {
  const scale = width / 297;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={297 * scale}
      height={102 * scale}
      fill="none"
      viewBox="0 0 99 34"
    >
      <path
        fill="#1A1A1A"
        d="m38.241 27.593.197-.065q.294-.098.49-.262.197-.163.327-.523.131-.393.197-1.014.065-.655.065-1.636V9.73q0-.982-.065-1.603-.066-.655-.197-1.015-.13-.392-.327-.556a1.5 1.5 0 0 0-.49-.261l-.197-.033v-.916h7.002q2.06 0 3.5.392 1.473.36 2.454.982 1.015.621 1.57 1.374.59.72.884 1.472.327.752.393 1.407.098.622.098 1.014 0 1.734-.655 3.141a6.5 6.5 0 0 1-1.897 2.389q-1.21.981-2.945 1.505-1.733.523-3.926.523h-1.995v4.548q0 .981.032 1.636.066.621.197 1.014.13.36.327.523.229.165.523.262l.196.065v.884h-5.758zm6.413-9.062q2.977 0 4.515-1.473 1.57-1.505 1.57-4.35 0-.884-.229-1.964a5.3 5.3 0 0 0-.916-2.061q-.687-.95-1.996-1.603-1.275-.655-3.402-.655h-1.472v12.106zM57.232 9.599a1.96 1.96 0 0 1-1.44-.589 2.07 2.07 0 0 1-.588-1.472q0-.884.589-1.473a1.96 1.96 0 0 1 1.44-.588q.882 0 1.472.588.589.59.589 1.473 0 .85-.622 1.472a1.96 1.96 0 0 1-1.44.589m3.043 17.896v.884h-5.66v-.884l.196-.065q.295-.099.491-.262.23-.163.36-.523.131-.393.196-1.015.066-.654.066-1.636v-7.197q0-.85-.099-1.342-.065-.49-.196-.752-.13-.294-.327-.393a1.4 1.4 0 0 0-.458-.13l-.23-.033v-.884l3.567-1.603.524-.033h.261v12.367q0 .982.066 1.636.065.622.196 1.015.165.36.36.523.196.164.49.262zM66.233 27.495v.884h-5.66v-.884l.196-.065q.295-.099.491-.262.23-.163.36-.523.131-.393.196-1.015.066-.654.066-1.636v-13.38q0-.851-.099-1.31-.065-.49-.196-.752-.13-.294-.327-.393a1.4 1.4 0 0 0-.458-.13l-.229-.033v-.884l3.566-1.635h.785v18.518q0 .982.066 1.635.065.622.196 1.015.165.36.36.523t.49.262zM72.23 27.495v.884h-5.66v-.884l.196-.065q.294-.099.49-.262.23-.163.36-.523.131-.393.197-1.015.065-.654.065-1.636v-13.38q0-.851-.098-1.31-.066-.49-.196-.752-.132-.294-.328-.393a1.4 1.4 0 0 0-.457-.13l-.23-.033v-.884l3.567-1.635h.785v18.518q0 .982.065 1.635.066.622.197 1.015.163.36.36.523.195.164.49.262zM88 27.462v.722h-.753q-.72 0-1.341-.08a4 4 0 0 1-1.113-.294 2.3 2.3 0 0 1-.752-.615q-.296-.373-.36-.935a5.8 5.8 0 0 1-1.374 1.096q-.72.427-1.865.774-1.113.348-2.716.348-1.112 0-2.126-.24a6.2 6.2 0 0 1-1.734-.695 4 4 0 0 1-1.21-1.176q-.427-.72-.426-1.683 0-1.095.687-1.87.72-.801 1.832-1.362a13 13 0 0 1 2.52-.935 54 54 0 0 1 2.813-.721l3.599-.802q0-2.084-.818-3.019-.786-.96-2.748-.961a3.5 3.5 0 0 0-1.407.267 4.5 4.5 0 0 0-1.113.614q-.458.375-.785.828-.327.428-.589.802-.72 1.041-1.701 1.042a2 2 0 0 1-.654-.107 1.12 1.12 0 0 1-.687-.535q-.197-.426.13-.961.263-.455.818-.935.556-.508 1.407-.909a10 10 0 0 1 1.996-.667q1.145-.268 2.552-.268t2.617.348 2.094 1.015q.916.641 1.407 1.603.523.934.523 2.164v5.289q0 .801.033 1.336.066.507.197.828a1 1 0 0 0 .327.427q.229.134.523.214zm-4.32-7.666-3.304.748q-.884.186-1.766.48a6.2 6.2 0 0 0-1.538.775q-.654.48-1.08 1.202-.392.722-.392 1.763 0 .615.261 1.122.296.508.72.882.458.374 1.047.588.622.213 1.243.213 1.244 0 2.094-.294.85-.32 1.407-.72.59-.401.883-.776.328-.373.426-.507zM97.416 14.506q.72.16.949.534.262.348.196.668-.065.4-.425.668-.327.267-.785.267-.262 0-.491-.027a18 18 0 0 0-.49-.106l-.524-.107a2.8 2.8 0 0 0-.556-.054q-1.048 0-1.702.561a3.6 3.6 0 0 0-.981 1.336v6.331q0 .802.065 1.336.066.507.196.828.165.294.36.428.197.134.491.213l.196.054v.721h-5.66v-.721l.197-.054a1.6 1.6 0 0 0 .49-.213.9.9 0 0 0 .36-.428q.13-.321.197-.828.065-.534.065-1.336v-6.09q0-.695-.098-1.096-.066-.4-.197-.614a.7.7 0 0 0-.327-.294 1.7 1.7 0 0 0-.458-.107l-.229-.053V15.6l3.566-1.068.524-.027h.262v1.95q.72-.801 1.8-1.416a4.56 4.56 0 0 1 2.29-.614q.392 0 .72.08"
      />
      <mask
        id="sr-logo-mask"
        width="34"
        height="34"
        x="0"
        y="0"
        maskUnits="userSpaceOnUse"
        style={{ maskType: "alpha" } as React.CSSProperties}
      >
        <circle cx="16.912" cy="16.912" r="16.912" fill="#1A1A1A" />
      </mask>
      <g mask="url(#sr-logo-mask)">
        <circle
          cx="16.912"
          cy="16.912"
          r="16.405"
          stroke="#1A1A1A"
          strokeWidth="1.012"
        />
        <path
          fill="#1A1A1A"
          d="M9.55 40.56V12.07l6.681-1.77v28.686zM17.306 38.986V10.3l6.967-1.724V40.56z"
        />
      </g>
    </svg>
  );
};

// ---------------------------------------------------------------------------
// Scene 0: Title Card — Pillar logo + title
// ---------------------------------------------------------------------------

const TitleScene = () => {
  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 48,
      }}
    >
      <PillarLogoWithName width={260} />
      <div style={{ maxWidth: 900, textAlign: "center" }}>
        <span
          style={{
            fontFamily: FONT,
            fontSize: 64,
            fontWeight: 600,
            color: COLORS.textPrimary,
            lineHeight: 1.3,
            letterSpacing: "-0.03em",
          }}
        >
          Secure secret exchange for copilots
        </span>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Animated Background — gradient blobs + dot pattern (adapted for 1080x1080)
// ---------------------------------------------------------------------------

const AnimatedBackground = ({ frame }: { frame: number }) => {
  const blob1X = 820 + Math.sin(frame * 0.008) * 70;
  const blob1Y = 150 + Math.cos(frame * 0.006) * 40;
  const blob2X = 200 + Math.cos(frame * 0.007) * 60;
  const blob2Y = 850 + Math.sin(frame * 0.005) * 35;
  const blob3X = 540 + Math.sin(frame * 0.01) * 45;
  const blob3Y = 540 + Math.cos(frame * 0.009) * 50;

  const chatActive = frame >= SCENES.chat.panelIn;
  const warmth = chatActive
    ? interpolate(frame, [SCENES.chat.panelIn, SCENES.summary.cardIn], [0, 1], {
        extrapolateRight: "clamp",
      })
    : 0;

  return (
    <>
      <div
        style={{
          position: "absolute",
          left: blob1X - 300,
          top: blob1Y - 300,
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(255, 160, 80, ${0.07 + warmth * 0.05}) 0%, transparent 70%)`,
          filter: "blur(80px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: blob2X - 350,
          top: blob2Y - 350,
          width: 700,
          height: 700,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(120, 140, 255, ${0.06 - warmth * 0.02}) 0%, transparent 70%)`,
          filter: "blur(100px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: blob3X - 250,
          top: blob3Y - 250,
          width: 500,
          height: 500,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(${COLORS.orangeRgb}, ${0.04 + warmth * 0.06}) 0%, transparent 65%)`,
          filter: "blur(90px)",
        }}
      />
      <svg
        width="1920"
        height="1080"
        style={{ position: "absolute", top: 0, left: 0 }}
      >
        <defs>
          <pattern
            id="sr-dots"
            x="0"
            y="0"
            width="28"
            height="28"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="1" cy="1" r="0.7" fill="rgba(0,0,0,0.04)" />
          </pattern>
          <radialGradient id="sr-dot-fade" cx="50%" cy="50%" r="65%">
            <stop offset="0%" stopColor="white" stopOpacity="0" />
            <stop offset="100%" stopColor="white" stopOpacity="0.7" />
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#sr-dots)" />
        <rect width="100%" height="100%" fill="url(#sr-dot-fade)" />
      </svg>
    </>
  );
};

// ---------------------------------------------------------------------------
// Scene 1: Prompt Typing — frosted glass, zoom-in start
// ---------------------------------------------------------------------------

const PromptScene = ({ frame, fps }: { frame: number; fps: number }) => {
  const TYPING_DURATION = 30;
  const PAUSE_AFTER = 12;
  const typingFrame = Math.max(0, frame - SCENES.prompt.typingStart);
  const charsToShow = Math.min(
    PROMPT_TEXT.length,
    Math.floor(
      interpolate(typingFrame, [0, TYPING_DURATION], [0, PROMPT_TEXT.length], {
        extrapolateRight: "clamp",
      })
    )
  );
  const visibleText = PROMPT_TEXT.slice(0, charsToShow);
  const showCursor = frame >= SCENES.prompt.typingStart;
  const cursorOpacity = !showCursor
    ? 0
    : charsToShow < PROMPT_TEXT.length
      ? 1
      : Math.round(
            ((frame - SCENES.prompt.typingStart - TYPING_DURATION) / 8) % 2
          ) === 0
        ? 1
        : 0;

  const inputEntrance = spring({
    frame: Math.max(0, frame - SCENES.prompt.start),
    fps,
    config: { damping: 20, stiffness: 100 },
  });

  const zoomOutStart =
    SCENES.prompt.typingStart + TYPING_DURATION + PAUSE_AFTER;
  const zoomOut =
    frame >= zoomOutStart
      ? spring({
          frame: frame - zoomOutStart,
          fps,
          config: { damping: 22, stiffness: 60 },
        })
      : 0;
  const promptScale = interpolate(zoomOut, [0, 1], [1.9, 1]);
  const promptY = interpolate(zoomOut, [0, 1], [280, 0]);

  return (
    <div
      style={{
        position: "absolute",
        top: 44,
        left: "50%",
        transform: `translateX(-50%) translateY(${interpolate(inputEntrance, [0, 1], [12, 0]) + promptY}px) scale(${promptScale})`,
        opacity: interpolate(inputEntrance, [0, 1], [0, 1]),
        transformOrigin: "center center",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "24px 36px",
          backgroundColor: "rgba(255, 255, 255, 0.88)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderRadius: 20,
          border: "1px solid rgba(0, 0, 0, 0.06)",
          boxShadow:
            "0 1px 2px rgba(0,0,0,0.03), 0 4px 16px rgba(0,0,0,0.05), 0 16px 48px rgba(0,0,0,0.03)",
        }}
      >
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#B0B0B0"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <span
          style={{
            fontFamily: FONT,
            fontSize: 32,
            fontWeight: 400,
            color: COLORS.textPrimary,
            letterSpacing: "-0.01em",
            whiteSpace: "nowrap",
          }}
        >
          {visibleText}
        </span>
        <span
          style={{
            width: 2,
            height: 32,
            borderRadius: 1,
            background: `linear-gradient(180deg, ${COLORS.textPrimary}, rgba(29, 29, 31, 0.3))`,
            opacity: cursorOpacity,
            marginLeft: -4,
          }}
        />
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Scene 2: Backend Card — create_api_key() → SECRET_REF
// ---------------------------------------------------------------------------

const BackendScene = ({ frame, fps }: { frame: number; fps: number }) => {
  const cardEntrance = spring({
    frame: Math.max(0, frame - SCENES.backend.cardIn),
    fps,
    config: { damping: 20, stiffness: 80 },
  });
  const line1 = spring({
    frame: Math.max(0, frame - SCENES.backend.line1),
    fps,
    config: { damping: 18, stiffness: 120 },
  });
  const arrow = spring({
    frame: Math.max(0, frame - SCENES.backend.arrow),
    fps,
    config: { damping: 15, stiffness: 100 },
  });
  const line2 = spring({
    frame: Math.max(0, frame - SCENES.backend.line2),
    fps,
    config: { damping: 18, stiffness: 120 },
  });
  const badge = spring({
    frame: Math.max(0, frame - SCENES.backend.badge),
    fps,
    config: { damping: 18, stiffness: 120 },
  });

  const neonAngle = ((frame - SCENES.backend.cardIn) * 2) % 360;

  return (
    <div
      style={{
        position: "absolute",
        top: "54%",
        left: "50%",
        transform: `translate(-50%, -50%) scale(${interpolate(cardEntrance, [0, 1], [0.9, 1])})`,
        opacity: interpolate(cardEntrance, [0, 1], [0, 1]),
        width: 1100,
      }}
    >
      <div
        style={{
          borderRadius: 22,
          padding: 1.5,
          background: `conic-gradient(from ${neonAngle}deg at 50% 50%, rgba(${COLORS.greenRgb}, 0.04) 0deg, rgba(${COLORS.greenRgb}, 0.22) 40deg, rgba(${COLORS.greenRgb}, 0.04) 80deg, transparent 80deg, transparent 360deg)`,
        }}
      >
        <div
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.92)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            borderRadius: 20,
            padding: "48px 60px",
            boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 32,
          }}
        >
          {/* YOUR BACKEND badge */}
          <span
            style={{
              fontFamily: MONO_FONT,
              fontSize: 26,
              fontWeight: 600,
              color: COLORS.green,
              letterSpacing: "0.1em",
              padding: "10px 24px",
              borderRadius: 10,
              backgroundColor: `rgba(${COLORS.greenRgb}, 0.08)`,
              border: `1px solid rgba(${COLORS.greenRgb}, 0.15)`,
            }}
          >
            YOUR BACKEND
          </span>

          {/* create_api_key() */}
          <div
            style={{
              opacity: interpolate(line1, [0, 1], [0, 1]),
              transform: `translateY(${interpolate(line1, [0, 1], [8, 0])}px)`,
            }}
          >
            <span
              style={{
                fontFamily: MONO_FONT,
                fontSize: 40,
                fontWeight: 600,
                color: COLORS.textPrimary,
              }}
            >
              create_api_key()
            </span>
          </div>

          {/* Arrow */}
          <div
            style={{
              opacity: interpolate(arrow, [0, 1], [0, 1]),
              transform: `translateY(${interpolate(arrow, [0, 1], [4, 0])}px) scaleY(${interpolate(arrow, [0, 1], [0.5, 1])})`,
            }}
          >
            <svg
              width="28"
              height="50"
              viewBox="0 0 28 50"
              fill="none"
              stroke={COLORS.textMuted}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="14" y1="0" x2="14" y2="43" />
              <polyline points="7 36 14 43 21 36" />
            </svg>
          </div>

          {/* secret_ref response */}
          <div
            style={{
              opacity: interpolate(line2, [0, 1], [0, 1]),
              transform: `translateY(${interpolate(line2, [0, 1], [8, 0])}px)`,
              padding: "20px 36px",
              borderRadius: 14,
              backgroundColor: `rgba(${COLORS.orangeRgb}, 0.05)`,
              border: `1.5px solid rgba(${COLORS.orangeRgb}, 0.18)`,
            }}
          >
            <span
              style={{
                fontFamily: MONO_FONT,
                fontSize: 34,
                fontWeight: 500,
                color: COLORS.orange,
              }}
            >
              {"→ { secret_ref: \"ref_a8f3…\" }"}
            </span>
          </div>

          {/* Lock badge */}
          <div
            style={{
              opacity: interpolate(badge, [0, 1], [0, 1]),
              transform: `translateY(${interpolate(badge, [0, 1], [6, 0])}px)`,
              display: "flex",
              alignItems: "center",
              gap: 14,
            }}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke={COLORS.textMuted}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span
              style={{
                fontFamily: FONT,
                fontSize: 30,
                fontWeight: 500,
                color: COLORS.textMuted,
              }}
            >
              Never returns the raw secret
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Burn Text Effect — character-by-character dissolution
// ---------------------------------------------------------------------------

const BurnText = ({
  text,
  burnFrame,
}: {
  text: string;
  burnFrame: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <span
      style={{
        display: "inline-flex",
        fontFamily: MONO_FONT,
        fontSize: 28,
        fontWeight: 600,
      }}
    >
      {text.split("").map((char, i) => {
        const progress = spring({
          frame: frame - burnFrame - i * 2,
          fps,
          config: { damping: 12, stiffness: 120, mass: 0.6 },
        });

        const opacity = interpolate(progress, [0, 0.3, 1], [1, 0.9, 0], {
          extrapolateRight: "clamp",
        });
        const translateY = interpolate(progress, [0, 1], [0, -16], {
          extrapolateRight: "clamp",
        });
        const scale = interpolate(progress, [0, 0.4, 1], [1, 1.15, 0.4], {
          extrapolateRight: "clamp",
        });

        let color: string;
        if (progress < 0.15) color = "#166534";
        else if (progress < 0.45) color = COLORS.orange;
        else color = COLORS.red;

        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              color,
              opacity,
              transform: `translateY(${translateY}px) scale(${scale})`,
            }}
          >
            {char === " " ? "\u00A0" : char}
          </span>
        );
      })}
    </span>
  );
};

// ---------------------------------------------------------------------------
// Scene 3+4: Chat Panel — message, reveal button, key burn
// ---------------------------------------------------------------------------

const ChatPanelScene = ({
  frame,
  fps,
}: {
  frame: number;
  fps: number;
}) => {
  const panelIn = spring({
    frame: Math.max(0, frame - SCENES.chat.panelIn),
    fps,
    config: { damping: 22, stiffness: 80, mass: 1.0 },
  });
  const messageIn = spring({
    frame: Math.max(0, frame - SCENES.chat.messageIn),
    fps,
    config: { damping: 18, stiffness: 120 },
  });
  const buttonIn = spring({
    frame: Math.max(0, frame - SCENES.chat.buttonIn),
    fps,
    config: { damping: 16, stiffness: 140 },
  });

  const isClicked = frame >= SCENES.chat.click;

  const keyIn = frame >= SCENES.reveal.keyIn
    ? spring({
        frame: frame - SCENES.reveal.keyIn,
        fps,
        config: { damping: 18, stiffness: 100, mass: 0.8 },
      })
    : 0;

  const isBurning = frame >= SCENES.reveal.burnStart;

  const stampIn = frame >= SCENES.reveal.stampIn
    ? spring({
        frame: frame - SCENES.reveal.stampIn,
        fps,
        config: { damping: 14, stiffness: 160, mass: 0.6 },
      })
    : 0;

  const showButton = frame >= SCENES.chat.buttonIn && !isClicked;

  const neonAngle = (Math.max(0, frame - SCENES.chat.panelIn) * 2) % 360;

  const glowFrame = Math.max(0, frame - SCENES.chat.panelIn - 15);
  const glowPulse =
    glowFrame > 0 && glowFrame < 40
      ? interpolate(glowFrame, [0, 15, 40], [0, 0.3, 0], {
          extrapolateRight: "clamp",
        })
      : 0;
  const breathe =
    frame >= SCENES.chat.buttonIn
      ? 0.12 + 0.08 * Math.sin((frame - SCENES.chat.buttonIn) * 0.06)
      : 0;
  const glowOpacity = Math.max(glowPulse, breathe);

  return (
    <div
      style={{
        position: "absolute",
        top: "54%",
        left: "50%",
        transform: `translate(-50%, -50%) scale(${interpolate(panelIn, [0, 1], [0.85, 1])})`,
        opacity: interpolate(panelIn, [0, 1], [0, 1]),
        width: 1100,
      }}
    >
      <div
        style={{
          borderRadius: 22,
          padding: 2,
          background: `conic-gradient(from ${neonAngle}deg at 50% 50%, rgba(${COLORS.orangeRgb}, 0.04) 0deg, rgba(${COLORS.orangeRgb}, ${0.25 + glowOpacity * 0.3}) 55deg, rgba(${COLORS.orangeRgb}, 0.04) 110deg, rgba(${COLORS.orangeRgb}, ${0.12 + glowOpacity * 0.15}) 200deg, rgba(${COLORS.orangeRgb}, 0.04) 250deg, transparent 250deg, transparent 360deg)`,
        }}
      >
        <div
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.92)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            borderRadius: 20,
            border: "0.5px solid rgba(0, 0, 0, 0.04)",
            boxShadow: `0 4px 24px rgba(0,0,0,0.06), 0 0 ${16 + glowOpacity * 20}px rgba(${COLORS.orangeRgb}, ${glowOpacity * 0.3})`,
            padding: "44px 56px",
            display: "flex",
            flexDirection: "column",
            gap: 28,
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: 9,
                backgroundColor: COLORS.orange,
              }}
            />
            <span
              style={{
                fontFamily: FONT,
                fontSize: 30,
                fontWeight: 600,
                color: COLORS.textPrimary,
                letterSpacing: "-0.02em",
              }}
            >
              Copilot
            </span>
          </div>

          {/* Divider */}
          <div
            style={{
              height: 1,
              background:
                "linear-gradient(90deg, transparent 4%, rgba(0,0,0,0.06) 25%, rgba(0,0,0,0.06) 75%, transparent 96%)",
            }}
          />

          {/* Message */}
          <div
            style={{
              opacity: interpolate(messageIn, [0, 1], [0, 1]),
              transform: `translateY(${interpolate(messageIn, [0, 1], [8, 0])}px)`,
            }}
          >
            <span
              style={{
                fontFamily: FONT,
                fontSize: 34,
                fontWeight: 400,
                color: COLORS.textPrimary,
                lineHeight: 1.5,
              }}
            >
              Sure! Here's your API key.
            </span>
          </div>

          {/* Reveal button / revealed key — same slot, no layout jump */}
          <div
            style={{
              opacity: interpolate(buttonIn > 0 ? buttonIn : keyIn, [0, 1], [0, 1]),
              transform: `translateY(${interpolate(buttonIn > 0 && !isClicked ? buttonIn : keyIn, [0, 1], [10, 0])}px)`,
            }}
          >
            {!isClicked ? (
              buttonIn > 0 && (
                <button
                  type="button"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "16px 28px",
                    border: "1.5px solid #e0e0e0",
                    borderRadius: 12,
                    backgroundColor: "#F9F9F9",
                    color: COLORS.textPrimary,
                    cursor: "pointer",
                    fontFamily: FONT,
                    fontSize: 28,
                    fontWeight: 500,
                  }}
                >
                  <svg
                    width="26"
                    height="26"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                  </svg>
                  <span>Reveal Secret</span>
                </button>
              )
            ) : (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 0,
                  border: `1.5px solid ${isBurning ? COLORS.red : "#e0e0e0"}`,
                  borderRadius: 12,
                  overflow: "hidden",
                  backgroundColor: isBurning
                    ? "rgba(239, 68, 68, 0.02)"
                    : "#F9F9F9",
                  transition: "border-color 0.2s",
                }}
              >
                <div
                  style={{
                    padding: "16px 28px",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  {isBurning ? (
                    <BurnText
                      text={API_KEY}
                      burnFrame={SCENES.reveal.burnStart}
                    />
                  ) : (
                    <span
                      style={{
                        fontFamily: MONO_FONT,
                        fontSize: 28,
                        fontWeight: 600,
                        color: "#166534",
                      }}
                    >
                      {API_KEY}
                    </span>
                  )}
                </div>
                {!isBurning && (
                  <>
                    <div
                      style={{
                        width: 1,
                        alignSelf: "stretch",
                        backgroundColor: "#e0e0e0",
                      }}
                    />
                    <div
                      style={{
                        padding: "16px 20px",
                        display: "flex",
                        alignItems: "center",
                        cursor: "pointer",
                      }}
                    >
                      <svg
                        width="22"
                        height="22"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={COLORS.textMuted}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Text below card — swaps between explanation and burned stamp */}
      {(showButton || stampIn > 0.1) && (
        <div
          style={{
            textAlign: "center",
            paddingTop: 24,
            opacity: showButton
              ? interpolate(buttonIn, [0, 1], [0, 1])
              : stampIn,
            transform: stampIn > 0.1 && !showButton
              ? `scale(${interpolate(stampIn, [0, 1], [0.7, 1])})`
              : undefined,
          }}
        >
          {showButton ? (
            <span
              style={{
                fontFamily: FONT,
                fontSize: 24,
                fontWeight: 400,
                color: COLORS.textMuted,
              }}
            >
              One-time redemption — the reference is burned after reveal
            </span>
          ) : (
            <span
              style={{
                fontFamily: MONO_FONT,
                fontSize: 26,
                fontWeight: 700,
                color: COLORS.red,
                letterSpacing: "0.06em",
              }}
            >
              REDEEMED 1/1 · REFERENCE BURNED
            </span>
          )}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Scene 5: Summary Card — Secret Exchange Complete
// ---------------------------------------------------------------------------

const SummaryScene = ({ frame, fps }: { frame: number; fps: number }) => {
  const cardIn = spring({
    frame: Math.max(0, frame - SCENES.summary.cardIn),
    fps,
    config: { damping: 22, stiffness: 80, mass: 1.0 },
  });

  const neonAngle = (Math.max(0, frame - SCENES.summary.cardIn) * 1.5) % 360;

  const ROWS = [
    { label: "Redeemed", value: "1 / 1", color: COLORS.green, icon: "✓" },
    { label: "Reference", value: "Expired", color: COLORS.red, icon: "✗" },
    { label: "TTL", value: "0s remaining", color: COLORS.textMuted, icon: "⏱" },
  ] as const;

  return (
    <div
      style={{
        position: "absolute",
        top: "54%",
        left: "50%",
        transform: `translate(-50%, -50%) scale(${interpolate(cardIn, [0, 1], [0.9, 1])})`,
        opacity: interpolate(cardIn, [0, 1], [0, 1]),
        width: 1060,
      }}
    >
      <div
        style={{
          borderRadius: 22,
          padding: 2,
          background: `conic-gradient(from ${neonAngle}deg at 50% 50%, rgba(${COLORS.greenRgb}, 0.04) 0deg, rgba(${COLORS.greenRgb}, 0.22) 45deg, rgba(${COLORS.greenRgb}, 0.04) 90deg, transparent 90deg, transparent 360deg)`,
        }}
      >
        <div
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.92)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            borderRadius: 20,
            border: "0.5px solid rgba(0, 0, 0, 0.04)",
            boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
            padding: "48px 60px",
            display: "flex",
            flexDirection: "column",
            gap: 30,
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke={COLORS.green}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <polyline points="9 12 11 14 15 10" />
            </svg>
            <span
              style={{
                fontFamily: FONT,
                fontSize: 36,
                fontWeight: 700,
                color: COLORS.textPrimary,
                letterSpacing: "-0.02em",
              }}
            >
              Secret Exchange Complete
            </span>
          </div>

          {/* Divider */}
          <div style={{ height: 1, backgroundColor: "rgba(0,0,0,0.06)" }} />

          {/* Rows */}
          {ROWS.map((row, i) => {
            const rowIn = spring({
              frame: Math.max(0, frame - SCENES.summary.cardIn - 10 - i * 8),
              fps,
              config: { damping: 18, stiffness: 120 },
            });
            return (
              <div
                key={row.label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  opacity: interpolate(rowIn, [0, 1], [0, 1]),
                  transform: `translateY(${interpolate(rowIn, [0, 1], [6, 0])}px)`,
                }}
              >
                <span
                  style={{
                    fontFamily: FONT,
                    fontSize: 30,
                    color: COLORS.textMuted,
                  }}
                >
                  {row.icon} {row.label}
                </span>
                <span
                  style={{
                    fontFamily: MONO_FONT,
                    fontSize: 30,
                    fontWeight: 600,
                    color: row.color,
                  }}
                >
                  {row.value}
                </span>
              </div>
            );
          })}

          {/* Footer */}
          <div style={{ height: 1, backgroundColor: "rgba(0,0,0,0.06)" }} />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 14,
            }}
          >
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke={COLORS.textMuted}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span
              style={{
                fontFamily: FONT,
                fontSize: 26,
                fontWeight: 500,
                color: COLORS.textMuted,
              }}
            >
              Secret never stored in chat history
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main Composition
// ---------------------------------------------------------------------------

export const SecretRevealAnimation = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const promptFadeOut =
    frame >= SCENES.hold.start
      ? interpolate(
          frame,
          [SCENES.hold.start, SCENES.hold.start + 15],
          [1, 0],
          { extrapolateRight: "clamp" }
        )
      : 1;

  const backendFadeOut =
    frame >= SCENES.backend.fadeOut
      ? interpolate(
          frame,
          [SCENES.backend.fadeOut, SCENES.backend.fadeOut + 15],
          [1, 0],
          { extrapolateRight: "clamp" }
        )
      : 1;

  const chatFadeOut =
    frame >= SCENES.chat.fadeOut
      ? interpolate(
          frame,
          [SCENES.chat.fadeOut, SCENES.chat.fadeOut + 15],
          [1, 0],
          { extrapolateRight: "clamp" }
        )
      : 1;

  const titleFadeOut =
    frame >= SCENES.title.fadeOut
      ? interpolate(
          frame,
          [SCENES.title.fadeOut, SCENES.title.fadeOut + 15],
          [1, 0],
          { extrapolateRight: "clamp" }
        )
      : 1;

  const showTitle = titleFadeOut > 0;
  const showPrompt = frame >= SCENES.prompt.start && promptFadeOut > 0;
  const showBackend = frame >= SCENES.backend.cardIn && backendFadeOut > 0;
  const showChat = frame >= SCENES.chat.panelIn && chatFadeOut > 0;
  const showSummary = frame >= SCENES.summary.cardIn;

  const ctaIn =
    frame >= SCENES.hold.start
      ? spring({
          frame: frame - SCENES.hold.start,
          fps,
          config: { damping: 20, stiffness: 100 },
        })
      : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background }}>
      <AnimatedBackground frame={frame} />

      {showTitle && (
        <div style={{ opacity: titleFadeOut }}>
          <TitleScene />
        </div>
      )}

      {showPrompt && (
        <div style={{ opacity: promptFadeOut }}>
          <PromptScene frame={frame} fps={fps} />
        </div>
      )}

      {showBackend && (
        <div style={{ opacity: backendFadeOut }}>
          <BackendScene frame={frame} fps={fps} />
        </div>
      )}

      {showChat && (
        <div style={{ opacity: chatFadeOut }}>
          <ChatPanelScene frame={frame} fps={fps} />
        </div>
      )}

      {showSummary && <SummaryScene frame={frame} fps={fps} />}

      {/* CTA */}
      {ctaIn > 0 && (
        <div
          style={{
            position: "absolute",
            bottom: 60,
            left: "50%",
            transform: "translateX(-50%)",
            opacity: interpolate(ctaIn, [0, 1], [0, 1]),
          }}
        >
          <span
            style={{
              fontFamily: MONO_FONT,
              fontSize: 28,
              fontWeight: 500,
              color: COLORS.textMuted,
              padding: "12px 28px",
              backgroundColor: "rgba(255,255,255,0.6)",
              borderRadius: 14,
              border: "1px solid rgba(0,0,0,0.05)",
            }}
          >
            trypillar.com
          </span>
        </div>
      )}
    </AbsoluteFill>
  );
};
