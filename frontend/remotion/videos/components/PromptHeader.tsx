/**
 * PromptHeader — Top bar showing the user's prompt with a typing animation.
 */

import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS, PROMPT_APPEAR_FRAMES } from "../constants";

interface PromptHeaderProps {
  prompt: string;
}

export const PromptHeader: React.FC<PromptHeaderProps> = ({ prompt }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Fade in the whole header
  const fadeIn = spring({
    frame,
    fps,
    config: { damping: 20, stiffness: 100 },
  });

  // Typing effect: reveal characters over PROMPT_APPEAR_FRAMES
  const charsToShow = Math.floor(
    interpolate(frame, [5, PROMPT_APPEAR_FRAMES], [0, prompt.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
  );

  const visibleText = prompt.slice(0, charsToShow);
  const showCursor = frame < PROMPT_APPEAR_FRAMES + 15;

  return (
    <div
      style={{
        backgroundColor: COLORS.prompt.background,
        border: `1.5px solid ${COLORS.prompt.border}`,
        borderRadius: 16,
        padding: "28px 36px",
        display: "flex",
        alignItems: "center",
        gap: 20,
        opacity: fadeIn,
        transform: `translateY(${interpolate(fadeIn, [0, 1], [10, 0])}px)`,
        boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
      }}
    >
      {/* User avatar */}
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: "#F3F4F6",
          border: "1.5px solid #E5E7EB",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <span style={{ color: "#6B7280", fontSize: 20 }}>U</span>
      </div>

      {/* Prompt text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: FONTS.sans,
            fontSize: 12,
            fontWeight: 500,
            color: COLORS.prompt.label,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: 6,
          }}
        >
          User Request
        </div>
        <div
          style={{
            fontFamily: FONTS.sans,
            fontSize: 22,
            fontWeight: 500,
            color: COLORS.prompt.text,
            lineHeight: 1.3,
          }}
        >
          {"\u201C"}{visibleText}
          {showCursor && (
            <span
              style={{
                opacity: Math.sin(frame * 0.3) > 0 ? 1 : 0,
                color: "#FF6E00",
              }}
            >
              |
            </span>
          )}
          {charsToShow >= prompt.length && "\u201D"}
        </div>
      </div>
    </div>
  );
};

export default PromptHeader;
