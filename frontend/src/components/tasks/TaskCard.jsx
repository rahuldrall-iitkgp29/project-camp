import React from "react";
import { Paperclip, CheckSquare, User, Clock } from "lucide-react";

export const TaskCard = ({ task, onClick }) => {
  // task shape: { _id, title, description, status, assignedTo: { _id, username, fullName, avatar }, attachements, subtasks }
  const attachmentsCount = task?.attachements?.length || 0;
  const subtasks = task?.subtasks || [];
  const completedSubtasks = subtasks.filter((st) => st.isCompleted).length;

  const statusBorderColors = {
    todo: "var(--info-border)",
    in_progress: "var(--warning-border)",
    done: "var(--success-border)",
  };

  return (
    <div
      onClick={onClick}
      className="glass-panel interactive-card"
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
      style={{
        padding: "16px",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        borderLeft: `3px solid ${statusBorderColors[task.status] || "var(--primary)"}`,
      }}
    >
      {/* Title */}
      <h4
        style={{
          fontSize: "0.95rem",
          fontWeight: 600,
          color: "var(--text-primary)",
          lineHeight: 1.4,
        }}
      >
        {task.title}
      </h4>

      {/* Description Snippet */}
      {task.description && (
        <p
          style={{
            fontSize: "0.82rem",
            color: "var(--text-secondary)",
            lineHeight: 1.4,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {task.description}
        </p>
      )}

      {/* Footer Badges */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: "8px",
          borderTop: "1px solid var(--border-subtle)",
          fontSize: "0.78rem",
          color: "var(--text-muted)",
        }}
      >
        {/* Assignee Avatar */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {task.assignedTo ? (
            <div
              className="avatar"
              style={{ width: "24px", height: "24px", fontSize: "0.7rem" }}
              title={`Assigned to ${task.assignedTo.username}`}
            >
              {task.assignedTo.username?.charAt(0).toUpperCase()}
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                color: "var(--text-disabled)",
              }}
            >
              <User size={13} />
              <span>Unassigned</span>
            </div>
          )}
        </div>

        {/* Indicators: Subtasks and Attachments */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {subtasks.length > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                color:
                  completedSubtasks === subtasks.length
                    ? "var(--success)"
                    : "var(--text-muted)",
              }}
              title={`${completedSubtasks} of ${subtasks.length} subtasks completed`}
            >
              <CheckSquare size={13} />
              <span>
                {completedSubtasks}/{subtasks.length}
              </span>
            </div>
          )}

          {attachmentsCount > 0 && (
            <div
              style={{ display: "flex", alignItems: "center", gap: "4px" }}
              title={`${attachmentsCount} file attachments`}
            >
              <Paperclip size={13} />
              <span>{attachmentsCount}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
