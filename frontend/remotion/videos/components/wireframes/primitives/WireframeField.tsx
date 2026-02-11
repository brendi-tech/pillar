/**
 * WireframeField — Reusable form field for wireframe compositions.
 *
 * Renders an uppercase label above a bordered input-style box.
 * The children slot holds the field content (text, avatar, skeleton, etc.).
 *
 * Used in: Banking (Recipient, Amount), CRM handoff (Deal, Contact, Notes),
 * HR (Routing Number, Account Number, Account Type).
 */

import React from "react";
import { COLORS, FONTS } from "../../../constants";

const WF = COLORS.wireframe;

interface WireframeFieldProps {
  /** Uppercase label text above the field */
  label: string;
  /** Border color. Default WF.border. Pass WF.accent for highlighted state. */
  borderColor?: string;
  /** Field background color. Default transparent. */
  backgroundColor?: string;
  /** Field height in px. Default 56. */
  height?: number;
  /** Border width. Default "2px". */
  borderWidth?: string;
  /** Border radius. Default 10. */
  borderRadius?: number;
  /** Horizontal padding inside the field. Default 20. */
  paddingX?: number;
  /** Gap between child elements. Default 14. */
  gap?: number;
  /** Bottom margin. Default 28. */
  marginBottom?: number;
  /** Optional box-shadow for glow effects. */
  boxShadow?: string;
  /** Label color override. Default WF.textLight. */
  labelColor?: string;
  children: React.ReactNode;
}

export const WireframeField: React.FC<WireframeFieldProps> = ({
  label,
  borderColor = WF.border,
  backgroundColor = "transparent",
  height = 56,
  borderWidth = "2px",
  borderRadius = 10,
  paddingX = 20,
  gap = 14,
  marginBottom = 28,
  boxShadow,
  labelColor = WF.textLight,
  children,
}) => {
  return (
    <div style={{ marginBottom }}>
      <div
        style={{
          fontFamily: FONTS.sans,
          fontSize: 15,
          fontWeight: 600,
          color: labelColor,
          marginBottom: 10,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </div>
      <div
        style={{
          height,
          borderRadius,
          border: `${borderWidth} solid ${borderColor}`,
          display: "flex",
          alignItems: "center",
          padding: `0 ${paddingX}px`,
          gap,
          backgroundColor,
          boxShadow,
        }}
      >
        {children}
      </div>
    </div>
  );
};
