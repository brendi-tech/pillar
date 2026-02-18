import { spring, interpolate } from "remotion";
import { IssueRow } from "./IssueRow";
import { SCENE_TIMING } from "./CameraController";

type ActiveCycleViewProps = {
  frame: number;
  fps: number;
  showNewIssue: boolean;
  issueId: string;
};

// Existing issues in the sprint
const EXISTING_ISSUES = [
  {
    id: "LIN-1231",
    title: "Update user settings page",
    type: "feature" as const,
    priority: "P2" as const,
    assignee: "AS",
  },
  {
    id: "LIN-1232",
    title: "Refactor API endpoints",
    type: "improvement" as const,
    priority: "P3" as const,
    assignee: "JM",
  },
  {
    id: "LIN-1233",
    title: "Add dark mode support",
    type: "feature" as const,
    priority: "P2" as const,
    assignee: "KL",
  },
  {
    id: "LIN-1230",
    title: "Fix login page styling",
    type: "bug" as const,
    priority: "P3" as const,
    assignee: "TR",
  },
];

// The new issue that will be created
const NEW_ISSUE = {
  id: "LIN-1234",
  title: "Checkout crash on payment confirmation",
  type: "bug" as const,
  priority: "P1" as const,
  assignee: "JM",
};

export const ActiveCycleView = ({
  frame,
  fps,
  showNewIssue,
  issueId,
}: ActiveCycleViewProps) => {
  // New issue entrance animation
  const newIssueProgress = showNewIssue
    ? spring({
        frame: Math.max(0, frame - SCENE_TIMING.SUCCESS),
        fps,
        config: { damping: 15, stiffness: 200 },
      })
    : 0;

  const newIssueOpacity = interpolate(newIssueProgress, [0, 1], [0, 1]);
  const newIssueY = interpolate(newIssueProgress, [0, 1], [-20, 0]);

  // Glow effect for new issue
  const glowOpacity = showNewIssue
    ? interpolate(
        frame - SCENE_TIMING.SUCCESS,
        [0, 15, 60],
        [0, 0.6, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
      )
    : 0;

  return (
    <div
      style={{
        backgroundColor: "#FFFFFF",
        borderRadius: 8,
        border: "1px solid #E5E7EB",
        overflow: "hidden",
      }}
    >
      {/* Table Header */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "40px 60px 1fr 80px 60px",
          gap: 16,
          padding: "12px 16px",
          backgroundColor: "#F9FAFB",
          borderBottom: "1px solid #E5E7EB",
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: 12,
          fontWeight: 600,
          color: "#6B7280",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
        }}
      >
        <div></div>
        <div>ID</div>
        <div>Title</div>
        <div>Priority</div>
        <div>Assignee</div>
      </div>

      {/* New Issue Row - appears at top when created */}
      {showNewIssue && (
        <div
          style={{
            opacity: newIssueOpacity,
            transform: `translateY(${newIssueY}px)`,
            position: "relative",
          }}
        >
          {/* Glow effect */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "#3B82F6",
              opacity: glowOpacity,
              pointerEvents: "none",
            }}
          />
          <IssueRow
            id={issueId}
            title={NEW_ISSUE.title}
            type={NEW_ISSUE.type}
            priority={NEW_ISSUE.priority}
            assignee={NEW_ISSUE.assignee}
            isNew={true}
          />
        </div>
      )}

      {/* Existing Issues */}
      {EXISTING_ISSUES.map((issue) => (
        <IssueRow
          key={issue.id}
          id={issue.id}
          title={issue.title}
          type={issue.type}
          priority={issue.priority}
          assignee={issue.assignee}
          isNew={false}
        />
      ))}
    </div>
  );
};
