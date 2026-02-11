/**
 * WireframeButton — Full-width action button for wireframe compositions.
 *
 * Used in: Banking (Send / Sent), HR (Save Changes).
 */

import React from "react";
import { COLORS, FONTS } from "../../../constants";

interface WireframeButtonProps {
  /** Button label text */
  label: string;
  /** Background color. Default accent (#FF6E00). */
  backgroundColor?: string;
  /** Opacity (0-1). Default 1. */
  opacity?: number;
  /** Scale transform value. Default 1. */
  scale?: number;
  /** Button height. Default 52. */
  height?: number;
  /** Font size. Default 18. */
  fontSize?: number;
}

export const WireframeButton: React.FC<WireframeButtonProps> = ({
  label,
  backgroundColor = COLORS.wireframe.accent,
  opacity = 1,
  scale = 1,
  height = 52,
  fontSize = 18,
}) => {
  return (
    <div
      style={{
        height,
        borderRadius: 10,
        backgroundColor,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity,
        transform: `scale(${scale})`,
      }}
    >
      <span
        style={{
          fontFamily: FONTS.sans,
          fontSize,
          fontWeight: 600,
          color: "#FFFFFF",
        }}
      >
        {label}
      </span>
    </div>
  );
};
