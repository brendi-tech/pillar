/**
 * SkeletonBar — Grey placeholder bar for loading/skeleton states.
 *
 * Used in wireframes to show unfilled fields before step activation.
 */

import React from "react";
import { COLORS } from "../../../constants";

interface SkeletonBarProps {
  /** Width of the bar, e.g. "70%" or "40%". */
  width: string;
  /** Height in px. Default 16. */
  height?: number;
  /** Border radius. Default 4. */
  borderRadius?: number;
}

export const SkeletonBar: React.FC<SkeletonBarProps> = ({
  width,
  height = 16,
  borderRadius = 4,
}) => {
  return (
    <div
      style={{
        width,
        height,
        backgroundColor: COLORS.wireframe.placeholder,
        borderRadius,
      }}
    />
  );
};
