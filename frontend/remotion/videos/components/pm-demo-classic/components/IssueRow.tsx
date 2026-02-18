type IssueType = "bug" | "feature" | "improvement";
type Priority = "P1" | "P2" | "P3" | "P4";

type IssueRowProps = {
  id: string;
  title: string;
  type: IssueType;
  priority: Priority;
  assignee: string;
  isNew?: boolean;
};

// Type icons and colors
const TYPE_CONFIG: Record<IssueType, { icon: string; color: string }> = {
  bug: { icon: "🐛", color: "#EF4444" },
  feature: { icon: "✨", color: "#8B5CF6" },
  improvement: { icon: "🔧", color: "#3B82F6" },
};

// Priority colors
const PRIORITY_COLORS: Record<Priority, { bg: string; text: string }> = {
  P1: { bg: "rgba(244, 63, 94, 0.15)", text: "#F43F5E" },
  P2: { bg: "rgba(249, 115, 22, 0.15)", text: "#F97316" },
  P3: { bg: "rgba(251, 191, 36, 0.15)", text: "#D97706" },
  P4: { bg: "rgba(156, 163, 175, 0.15)", text: "#6B7280" },
};

export const IssueRow = ({
  id,
  title,
  type,
  priority,
  assignee,
  isNew = false,
}: IssueRowProps) => {
  const typeConfig = TYPE_CONFIG[type];
  const priorityColors = PRIORITY_COLORS[priority];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "40px 60px 1fr 80px 60px",
        gap: 16,
        padding: "14px 16px",
        borderBottom: "1px solid #E5E7EB",
        backgroundColor: isNew ? "#F0F9FF" : "#FFFFFF",
        alignItems: "center",
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Checkbox */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: 4,
            border: "2px solid #D1D5DB",
            backgroundColor: "#FFFFFF",
          }}
        />
      </div>

      {/* Issue ID with type icon */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span style={{ fontSize: 14 }}>{typeConfig.icon}</span>
        <span
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: "#6B7280",
            fontFamily: 'ui-monospace, "SF Mono", monospace',
          }}
        >
          {id.split("-")[1]}
        </span>
      </div>

      {/* Title */}
      <div
        style={{
          fontSize: 15,
          fontWeight: isNew ? 600 : 500,
          color: "#1A1A1A",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {title}
      </div>

      {/* Priority Badge */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
        }}
      >
        <span
          style={{
            padding: "4px 10px",
            backgroundColor: priorityColors.bg,
            color: priorityColors.text,
            borderRadius: 4,
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {priority}
        </span>
      </div>

      {/* Assignee Avatar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            backgroundColor: "#E5E7EB",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            fontWeight: 600,
            color: "#4B5563",
          }}
        >
          {assignee}
        </div>
      </div>
    </div>
  );
};
