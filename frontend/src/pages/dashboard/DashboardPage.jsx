import React, { useEffect, useState } from "react";
import { Plus, FolderKanban, RefreshCw } from "lucide-react";
import { useProject } from "../../context/ProjectContext.jsx";
import { ProjectCard } from "../../components/projects/ProjectCard.jsx";
import { CreateProjectModal } from "../../components/projects/CreateProjectModal.jsx";

export const DashboardPage = () => {
  const { projects, loadingProjects, loadProjects } = useProject();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  return (
    <div
      style={{
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "40px 24px",
        width: "100%",
      }}
    >
      {/* Header Banner */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginBottom: "36px",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div>
          <h1>Your projects</h1>
          <p style={{ marginTop: "6px", fontSize: "0.95rem" }}>
            Keep track of your team's tasks, notes, and progress.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => loadProjects()}
            title="Refresh projects"
            disabled={loadingProjects}
          >
            <RefreshCw size={16} className={loadingProjects ? "spin" : ""} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setIsCreateModalOpen(true)}
          >
            <Plus size={18} />
            <span>New Project</span>
          </button>
        </div>
      </div>

      {/* Projects Grid or Loading/Empty State */}
      {loadingProjects && projects.length === 0 ? (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "80px 0",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <div
              style={{
                width: "36px",
                height: "36px",
                border: "3px solid var(--border-medium)",
                borderTopColor: "var(--primary)",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
              }}
            />
            <span style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
              Loading your projects...
            </span>
          </div>
        </div>
      ) : projects.length > 0 ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 320px), 1fr))",
            gap: "20px",
          }}
        >
          {projects.map((item, idx) => (
            <ProjectCard key={item.project?._id || idx} projectData={item} />
          ))}
        </div>
      ) : (
        /* Empty State */
        <div
          className="glass-panel"
          style={{
            padding: "60px 24px",
            textAlign: "center",
            maxWidth: "500px",
            margin: "40px auto",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "var(--radius-md)",
              backgroundColor: "var(--bg-tertiary)",
              color: "var(--primary-light)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
            }}
          >
            <FolderKanban size={24} />
          </div>
          <h3 style={{ fontSize: "1.3rem", marginBottom: "8px" }}>
            No projects yet
          </h3>
          <p
            style={{
              color: "var(--text-secondary)",
              marginBottom: "24px",
              fontSize: "0.9rem",
            }}
          >
            Create a project to start organizing work with your team.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setIsCreateModalOpen(true)}
          >
            <Plus size={18} />
            <span>Create Project</span>
          </button>
        </div>
      )}

      {/* Create Project Modal */}
      <CreateProjectModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
};
