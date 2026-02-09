import { clsx, type ClassValue } from "clsx";
import * as LucideIcons from "lucide-react";
import * as React from "react";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Generate a URL-friendly slug from a string.
 * Converts to lowercase, removes special characters, and replaces spaces with hyphens.
 * Best used for auto-generating slugs from titles (trims leading/trailing dashes).
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Sanitize slug input for live editing.
 * Similar to generateSlug but preserves trailing dashes so users can continue typing.
 * Spaces are converted to dashes to allow natural typing.
 */
export function sanitizeSlugInput(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+/, ""); // Only remove leading dashes, preserve trailing
}

/**
 * Render a Lucide icon by name.
 * Returns null if the icon name is not found or empty.
 */
export function renderLucideIcon(
  iconName: string | undefined,
  className?: string
): React.ReactElement | null {
  if (!iconName) return null;

  const Icon = LucideIcons[iconName as keyof typeof LucideIcons];

  // Ensure it's a valid React component (function), not a string or other export
  if (!Icon || typeof Icon !== "function") return null;

  return React.createElement(
    Icon as React.ComponentType<{ className?: string }>,
    { className }
  );
}
