/**
 * SourcesCard - Presentational component for displaying sources with favicons
 * Pure UI component with no business logic
 */
import { Source } from "./types";
import "./SourcesCard.css";

/**
 * Get favicon URL for a given domain
 */
function getFaviconUrl(url: string | null): string {
  if (!url) {
    // Document icon for sources without URLs
    return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%23718096" stroke-width="2"%3E%3Cpath d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"%3E%3C/path%3E%3Cpolyline points="14 2 14 8 20 8"%3E%3C/polyline%3E%3C/svg%3E';
  }

  try {
    const urlObj = new URL(url);
    const domain = urlObj.origin;
    // Use Google's favicon service as a reliable fallback
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch {
    // Link icon for invalid URLs
    return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%23718096" stroke-width="2"%3E%3Cpath d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"%3E%3C/path%3E%3Cpath d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"%3E%3C/path%3E%3C/svg%3E';
  }
}

/**
 * Individual source card component
 */
function SourceItem({
  source,
  theme,
}: {
  source: Source;
  theme: "light" | "dark";
}) {
  const faviconUrl = getFaviconUrl(source.url);
  const isDark = theme === "dark";

  const handleClick = () => {
    if (source.url && window.openai?.openExternal) {
      window.openai.openExternal({ href: source.url });
    } else if (source.url) {
      // Fallback for non-ChatGPT environments (like widget)
      window.open(source.url, "_blank", "noopener,noreferrer");
    }
  };

  const itemClasses = [
    'source-item',
    isDark ? 'source-item--dark' : 'source-item--light',
    source.url ? 'source-item--clickable' : 'source-item--default'
  ].join(' ');

  return (
    <div onClick={handleClick} className={itemClasses}>
      {/* Favicon */}
      <div className="source-item__favicon-container">
        <img
          src={faviconUrl}
          alt=""
          className="source-item__favicon"
          onError={(e) => {
            // Fallback to generic icon on error
            e.currentTarget.src =
              'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%23718096" stroke-width="2"%3E%3Ccircle cx="12" cy="12" r="10"%3E%3C/circle%3E%3Cline x1="12" y1="16" x2="12" y2="12"%3E%3C/line%3E%3Cline x1="12" y1="8" x2="12.01" y2="8"%3E%3C/line%3E%3C/svg%3E';
          }}
        />
      </div>

      {/* Content */}
      <div className="source-item__content">
        <div className={`source-item__title ${isDark ? 'source-item__title--dark' : 'source-item__title--light'}`}>
          {source.title || "Untitled"}
        </div>

        {source.url && (
          <div className={`source-item__url ${isDark ? 'source-item__url--dark' : 'source-item__url--light'}`}>
            {(() => {
              try {
                return new URL(source.url).hostname;
              } catch {
                return source.url;
              }
            })()}
          </div>
        )}

        {source.type === "document" && (
          <div className={`source-item__type-badge ${isDark ? 'source-item__type-badge--dark' : 'source-item__type-badge--light'}`}>
            Document
          </div>
        )}
      </div>

      {/* Citation number badge */}
      {source.citation_number && (
        <div className={`source-item__citation ${isDark ? 'source-item__citation--dark' : 'source-item__citation--light'}`}>
          {source.citation_number}
        </div>
      )}
    </div>
  );
}

/**
 * Main SourcesCard component - Pure presentational component
 * Requires sources and theme to be passed as props
 */
export interface SourcesCardProps {
  sources: Source[];
  theme?: "light" | "dark";
}

export function SourcesCard({ sources, theme = "light" }: SourcesCardProps) {
  if (!sources || sources.length === 0) {
    return null;
  }

  const isDark = theme === "dark";

  return (
    <div className="sources-card">
      <h3 className={`sources-card__title ${isDark ? 'sources-card__title--dark' : 'sources-card__title--light'}`}>
        Sources
      </h3>

      <div className="sources-card__list">
        {sources.map((source, index) => (
          <SourceItem key={index} source={source} theme={theme} />
        ))}
      </div>
    </div>
  );
}

export default SourcesCard;
