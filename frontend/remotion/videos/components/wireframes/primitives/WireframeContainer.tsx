/**
 * WireframeContainer — Shared wrapper for all wireframe compositions.
 *
 * Provides:
 * - Full-bleed centering (fills the composition frame)
 * - Dashed-border container with rounded corners
 * - Component label positioned over the top border (JSX-style tag)
 * - Opacity driven by step spring value
 *
 * Works in both DemoComposition (1920x1080, right column ~1240px) and
 * WireframeComposition (1080x1080, full square ~1040px).
 */

import React from "react";
import { interpolate } from "remotion";
import { COLORS, FONTS } from "../../../constants";

const WF = COLORS.wireframe;

interface WireframeContainerProps {
  /** JSX-style component label, e.g. "<PaymentForm>" */
  label: string;
  /** Spring value (0-1) controlling the container fade-in (0.3 -> 1.0) */
  opacity: number;
  /** Max width of the dashed container. Default 700 (fits both layouts). */
  maxWidth?: number;
  /** Container background color. Default WF.background (#FFFFFF). */
  backgroundColor?: string;
  /** Inner padding. Default 40. */
  padding?: number;
  children: React.ReactNode;
}

export const WireframeContainer: React.FC<WireframeContainerProps> = ({
  label,
  opacity,
  maxWidth = 700,
  backgroundColor = WF.background,
  padding = 40,
  children,
}) => {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth,
          border: `2px dashed ${WF.border}`,
          borderRadius: 20,
          padding,
          backgroundColor,
          opacity: interpolate(opacity, [0, 1], [0.3, 1]),
          position: "relative",
        }}
      >
        {/* Component label */}
        <div
          style={{
            position: "absolute",
            top: -14,
            left: 32,
            backgroundColor: COLORS.background,
            padding: "2px 12px",
          }}
        >
          <span
            style={{
              fontFamily: FONTS.mono,
              fontSize: 16,
              color: WF.textLight,
              fontWeight: 500,
            }}
          >
            {label}
          </span>
        </div>

        {children}
      </div>
    </div>
  );
};
