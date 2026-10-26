import React from "react";
import { Link } from "react-router-dom";
import { Users, Calendar, ArrowRight, Shield } from "lucide-react";

export const ProjectCard = ({ projectData }) => {
  // projectData shape from GET /projects aggregation: { project: { _id, name, description, members, createdAt, createdBy }, role }
  const project = projectData?.project || projectData;
  const role = projectData?.role || "member";

  const memberCount = project?.members ?? 1;

  const roleLabels = {
    admin: "Admin",
    project_admin: "Project Admin",
    member: "Member",
  };

  const formattedDate = project?.createdAt
    ? new Date(project.createdAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";

  return (
    <Link
      to={`/projects/${project._id}`}
      className="glass-panel interactive-card"
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "24px",
        height: "100%",
        cursor: "pointer",
        position: "relative",
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <div>
        {/* Top: Role Badge & Members */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
          }}
        >
          <span className={`badge badge-${role}`}>
            <Shield size={12} />
            <span>{roleLabels[role] || role}</span>
          </span>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "5px",
              color: "var(--text-muted)",
              fontSize: "0.8rem",
            }}
          >
            <Users size={14} />
            <span>
              {memberCount} {memberCount === 1 ? "member" : "members"}
            </span>
          </div>
        </div>

        {/* Project Title */}
        <h3
          style={{
            fontSize: "1.2rem",
            marginBottom: "8px",
            color: "var(--text-primary)",
            fontWeight: 600,
          }}
        >
          {project.name}
        </h3>

        {/* Description */}
        <p
          style={{
            fontSize: "0.88rem",
            color: "var(--text-secondary)",
            lineHeight: 1.5,
            marginBottom: "20px",
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {project.description || "No description provided."}
        </p>
      </div>

      {/* Footer Info */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          paddingTop: "14px",
          borderTop: "1px solid var(--border-subtle)",
          fontSize: "0.8rem",
          color: "var(--text-muted)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <Calendar size={13} />
          <span>{formattedDate}</span>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            color: "var(--primary-light)",
            fontWeight: 600,
          }}
        >
          <span>Open</span>
          <ArrowRight size={14} />
        </div>
      </div>
    </Link>
  );
};
