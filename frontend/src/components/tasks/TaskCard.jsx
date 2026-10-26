import React from "react";
import { Paperclip, CheckSquare, User, Clock } from "lucide-react";

export const TaskCard = ({ task, onClick }) => {
  // task shape: { _id, title, description, status, assignedTo: { _id, username, fullName, avatar }, attachements, subtasks }
  const attachmentsCount = task?.attachements?.length || 0;
  const subtasks = task?.subtasks || [];
  const completedSubtasks = subtasks.filter((st) => st.isCompleted).length;

  const statusBorderColors = {
    todo: "rgba(14, 165, 233, 0.4)",
    in_progress: "rgba(245, 158, 11, 0.4)",
    done: "rgba(16, 185, 129, 0.4)",
  };

  return (
    <div
      onClick={onClick}
      className="glass-panel"
      style={{
        padding: "16px",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        borderLeft: `3px solid ${statusBorderColors[task.status] || "var(--primary)"}`,
        backgroundColor: "var(--bg-tertiary)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.backgroundColor = "var(--bg-card-hover)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "none";
        e.currentTarget.style.backgroundColor = "var(--bg-tertiary)";
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
