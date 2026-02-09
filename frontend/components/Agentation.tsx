"use client";

import { Agentation as AgentationComponent } from "agentation";

/**
 * Agentation - Visual feedback tool for AI coding agents
 * Only renders in development mode
 * 
 * Usage: Click elements on your page, add notes, and copy structured
 * markdown output to paste into Cursor or other AI coding agents.
 * 
 * @see https://agentation.dev
 */
export function Agentation() {
  // Only render in development
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  return <AgentationComponent />;
}
