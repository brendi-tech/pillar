interface SectionLabelProps {
  children: React.ReactNode;
  /** Optional annotation rendered after the label in normal-case */
  annotation?: React.ReactNode;
  /** Bottom margin class. Default: "mb-1.5" */
  className?: string;
}

/**
 * Uppercase section header used to label content sections in detail pages.
 */
export function SectionLabel({
  children,
  annotation,
  className = "mb-1.5",
}: SectionLabelProps) {
  return (
    <h3
      className={`text-xs font-medium uppercase tracking-wider text-muted-foreground ${className}`}
    >
      {children}
      {annotation && (
        <span className="ml-1.5 font-normal normal-case tracking-normal">
          {annotation}
        </span>
      )}
    </h3>
  );
}
