"use client";

interface DetailHeaderProps {
  /** Optional icon element rendered in a muted rounded box */
  icon?: React.ReactNode;
  /** Primary title */
  title: string;
  /** Subtitle text (e.g. mono slug, type label) */
  subtitle?: string;
  /** Whether subtitle should use monospace font */
  subtitleMono?: boolean;
  /** Inline badges row rendered below the title */
  badges?: React.ReactNode;
  /** Action buttons rendered on the right side of the header */
  actions?: React.ReactNode;
}

/**
 * Shared header for detail pages. Renders icon + title + subtitle on the left,
 * action buttons on the right, and an inline badges row below.
 */
export function DetailHeader({
  icon,
  title,
  subtitle,
  subtitleMono = false,
  badges,
  actions,
}: DetailHeaderProps) {
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            {icon && (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                {icon}
              </div>
            )}
            <div>
              <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
              {subtitle && (
                <p
                  className={`mt-0.5 text-sm text-muted-foreground ${subtitleMono ? "font-mono text-xs" : ""}`}
                >
                  {subtitle}
                </p>
              )}
            </div>
          </div>
        </div>
        {actions && (
          <div className="flex items-center gap-2 shrink-0">{actions}</div>
        )}
      </div>

      {badges && (
        <div className="mt-3 flex flex-wrap items-center gap-2">{badges}</div>
      )}
    </div>
  );
}
