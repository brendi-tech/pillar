import { interpolate, spring } from "remotion";
import { LineChart } from "./LineChart";
import { SCENE_TIMING } from "./CameraController";

type ChartEditorProps = {
  frame: number;
  fps: number;
  entranceFrame: number;
};

// SQL query to be typed out
const SQL_QUERY = `SELECT 
  DATE_TRUNC('week', created_at) as week,
  COUNT(*) as signups
FROM users
WHERE created_at >= NOW() - INTERVAL '12 weeks'
GROUP BY week
ORDER BY week`;

// Dataset options
const DATASETS = [
  { name: "users", description: "User signups and profiles", rows: "1.2M" },
  { name: "events", description: "User activity events", rows: "45M" },
  { name: "transactions", description: "Payment transactions", rows: "890K" },
];

export const ChartEditor = ({
  frame,
  fps,
  entranceFrame,
}: ChartEditorProps) => {
  // Entrance animation
  const entranceProgress = spring({
    frame: Math.max(0, frame - entranceFrame),
    fps,
    config: { damping: 20, stiffness: 150 },
  });
  
  const scale = interpolate(entranceProgress, [0, 1], [0.95, 1]);
  const opacity = interpolate(entranceProgress, [0, 1], [0, 1]);
  
  // State based on frame timing
  const showDatasets = frame >= SCENE_TIMING.LIST_DATASETS_START;
  const datasetSelected = frame >= SCENE_TIMING.GET_DATASET_START;
  const showSqlEditor = frame >= SCENE_TIMING.WRITING_SQL_START;
  const isTypingSql = frame >= SCENE_TIMING.INPUT_SQL_START && frame < SCENE_TIMING.INPUT_SQL_END;
  const sqlTypingComplete = frame >= SCENE_TIMING.INPUT_SQL_END;
  const showPreview = frame >= SCENE_TIMING.PREVIEW_START;
  const isSaving = frame >= SCENE_TIMING.SAVE_DASHBOARD_START;
  
  // SQL typing animation
  const sqlTypingProgress = interpolate(
    frame - SCENE_TIMING.INPUT_SQL_START,
    [0, SCENE_TIMING.INPUT_SQL_END - SCENE_TIMING.INPUT_SQL_START],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const charsToShow = Math.floor(sqlTypingProgress * SQL_QUERY.length);
  const displayedSql = SQL_QUERY.slice(0, charsToShow);
  
  // Dataset selection animation
  const datasetSelectProgress = spring({
    frame: Math.max(0, frame - SCENE_TIMING.GET_DATASET_START),
    fps,
    config: { damping: 15, stiffness: 200 },
  });
  
  // Save button animation
  const saveButtonProgress = spring({
    frame: Math.max(0, frame - SCENE_TIMING.SAVE_DASHBOARD_START),
    fps,
    config: { damping: 15, stiffness: 200 },
  });
  
  // Cursor blink for SQL editor
  const cursorVisible = isTypingSql && Math.floor((frame - SCENE_TIMING.INPUT_SQL_START) / 8) % 2 === 0;
  
  return (
    <div
      style={{
        position: "absolute",
        top: 80,
        left: 32,
        right: 32,
        bottom: 32,
        backgroundColor: "#FFFFFF",
        borderRadius: 20,
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)",
        transform: `scale(${scale})`,
        opacity,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "20px 28px",
          borderBottom: "1px solid #E5E0D8",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <h2
          style={{
            fontSize: 22,
            fontWeight: 600,
            color: "#1A1A1A",
            margin: 0,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          }}
        >
          Create Chart with SQL
        </h2>
        
        {/* Run Query / Save buttons */}
        <div style={{ display: "flex", gap: 12 }}>
          {showPreview && !isSaving && (
            <button
              style={{
                padding: "10px 20px",
                backgroundColor: "#F8F7F5",
                border: "1px solid #E5E0D8",
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 500,
                color: "#666666",
                cursor: "pointer",
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              }}
            >
              Run Query
            </button>
          )}
          
          <button
            style={{
              padding: "10px 20px",
              backgroundColor: isSaving ? "#16A34A" : "#22C55E",
              border: "none",
              borderRadius: 10,
              fontSize: 15,
              fontWeight: 600,
              color: "#FFFFFF",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              transform: isSaving ? `scale(${0.95 + 0.05 * saveButtonProgress})` : "scale(1)",
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            }}
          >
            {isSaving && saveButtonProgress > 0.5 ? (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Saved!
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <line x1="12" y1="8" x2="12" y2="16" />
                  <line x1="8" y1="12" x2="16" y2="12" />
                </svg>
                Save to Dashboard
              </>
            )}
          </button>
        </div>
      </div>
      
      {/* Main content area */}
      <div
        style={{
          flex: 1,
          display: "flex",
          overflow: "hidden",
        }}
      >
        {/* Left side - Dataset selector and SQL editor */}
        <div
          style={{
            width: "45%",
            display: "flex",
            flexDirection: "column",
            borderRight: "1px solid #E5E0D8",
          }}
        >
          {/* Dataset selector */}
          <div
            style={{
              padding: "20px 24px",
              borderBottom: "1px solid #E5E0D8",
            }}
          >
            <label
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 600,
                color: "#666666",
                marginBottom: 12,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              }}
            >
              Data Source
            </label>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {DATASETS.map((dataset, index) => {
                const isSelected = dataset.name === "users" && datasetSelected;
                const isHighlighted = dataset.name === "users";
                
                return (
                  <div
                    key={dataset.name}
                    style={{
                      padding: "12px 16px",
                      backgroundColor: isSelected
                        ? `rgba(34, 197, 94, ${0.1 * datasetSelectProgress})`
                        : showDatasets ? "#FAFAFA" : "#F5F5F5",
                      border: isSelected
                        ? `2px solid rgba(34, 197, 94, ${datasetSelectProgress})`
                        : isHighlighted && showDatasets && !datasetSelected
                          ? "2px solid #E5E0D8"
                          : "1px solid #E5E0D8",
                      borderRadius: 10,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      opacity: showDatasets ? 1 : 0.5,
                      transform: showDatasets
                        ? `translateX(0)`
                        : `translateX(-10px)`,
                      transition: "none",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      {isSelected && (
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#22C55E"
                          strokeWidth="3"
                          style={{
                            opacity: datasetSelectProgress,
                            transform: `scale(${datasetSelectProgress})`,
                          }}
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                      <div>
                        <div
                          style={{
                            fontSize: 15,
                            fontWeight: isSelected ? 600 : 500,
                            color: isSelected ? "#22C55E" : "#1A1A1A",
                            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                          }}
                        >
                          {dataset.name}
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: "#999999",
                            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                          }}
                        >
                          {dataset.description}
                        </div>
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: 12,
                        color: "#999999",
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                      }}
                    >
                      {dataset.rows} rows
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* SQL Editor */}
          <div
            style={{
              flex: 1,
              padding: "20px 24px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <label
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 600,
                color: "#666666",
                marginBottom: 12,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              }}
            >
              SQL Query
            </label>
            
            <div
              style={{
                flex: 1,
                backgroundColor: "#1E1E32",
                borderRadius: 12,
                padding: 20,
                fontFamily: '"SF Mono", "Monaco", "Inconsolata", "Fira Code", monospace',
                fontSize: 14,
                lineHeight: 1.6,
                overflow: "hidden",
                opacity: showSqlEditor ? 1 : 0.3,
              }}
            >
              {showSqlEditor ? (
                <pre
                  style={{
                    margin: 0,
                    color: "#E5E0D8",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {/* Syntax highlighting */}
                  {(sqlTypingComplete ? SQL_QUERY : displayedSql).split('\n').map((line, i) => (
                    <div key={i}>
                      {line.split(/(\b(?:SELECT|FROM|WHERE|GROUP BY|ORDER BY|COUNT|DATE_TRUNC|NOW|INTERVAL|as)\b|'[^']*')/gi).map((part, j) => {
                        const isKeyword = /^(SELECT|FROM|WHERE|GROUP BY|ORDER BY)$/i.test(part);
                        const isFunction = /^(COUNT|DATE_TRUNC|NOW|INTERVAL)$/i.test(part);
                        const isAlias = /^as$/i.test(part);
                        const isString = /^'[^']*'$/.test(part);
                        
                        return (
                          <span
                            key={j}
                            style={{
                              color: isKeyword
                                ? "#569CD6"
                                : isFunction
                                  ? "#DCDCAA"
                                  : isAlias
                                    ? "#569CD6"
                                    : isString
                                      ? "#CE9178"
                                      : "#E5E0D8",
                            }}
                          >
                            {part}
                          </span>
                        );
                      })}
                    </div>
                  ))}
                  {cursorVisible && (
                    <span
                      style={{
                        display: "inline-block",
                        width: 2,
                        height: 16,
                        backgroundColor: "#22C55E",
                        marginLeft: 1,
                        verticalAlign: "text-bottom",
                      }}
                    />
                  )}
                </pre>
              ) : (
                <span style={{ color: "#666666" }}>-- Write your SQL query here</span>
              )}
            </div>
          </div>
        </div>
        
        {/* Right side - Results preview */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            backgroundColor: "#FAFAFA",
          }}
        >
          <div
            style={{
              padding: "20px 24px",
              borderBottom: "1px solid #E5E0D8",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <h3
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: "#1A1A1A",
                margin: 0,
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              }}
            >
              {showPreview ? "Weekly Signups" : "Results Preview"}
            </h3>
            {showPreview && (
              <span
                style={{
                  fontSize: 13,
                  color: "#22C55E",
                  fontWeight: 500,
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                }}
              >
                12 rows returned
              </span>
            )}
          </div>
          
          {/* Chart/Results area */}
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
            }}
          >
            {showPreview ? (
              <LineChart
                frame={frame}
                fps={fps}
                drawStartFrame={SCENE_TIMING.PREVIEW_START + 5}
                isWeekly={true}
                width={420}
                height={260}
                showLabels={true}
              />
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 16,
                  color: "#999999",
                }}
              >
                <svg
                  width="56"
                  height="56"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#E5E0D8"
                  strokeWidth="1.5"
                >
                  <polyline points="4 18 8 12 12 15 16 8 20 12" />
                  <line x1="4" y1="4" x2="4" y2="20" />
                  <line x1="4" y1="20" x2="20" y2="20" />
                </svg>
                <span
                  style={{
                    fontSize: 14,
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  }}
                >
                  Run query to see results
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
