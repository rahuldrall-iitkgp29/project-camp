import React, { useEffect, useState } from "react";
import { Plus, FolderKanban, Sparkles, RefreshCw } from "lucide-react";
import { useProject } from "../../context/ProjectContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { ProjectCard } from "../../components/projects/ProjectCard.jsx";
import { CreateProjectModal } from "../../components/projects/CreateProjectModal.jsx";

export const DashboardPage = () => {
  const { projects, loadingProjects, loadProjects } = useProject();
  const { user } = useAuth();
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
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              color: "var(--primary-light)",
              fontSize: "0.85rem",
              fontWeight: 600,
              marginBottom: "6px",
            }}
          >
            <Sparkles size={16} />
            <span>PROJECT WORKSPACE</span>
          </div>
          <h1>Welcome, {user?.fullName || user?.username}!</h1>
          <p style={{ marginTop: "6px", fontSize: "0.95rem" }}>
            Select an existing project or create a new team workspace to manage
            tasks and notes.
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
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: "24px",
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
              width: "64px",
              height: "64px",
              borderRadius: "50%",
              backgroundColor: "rgba(99, 102, 241, 0.12)",
              color: "var(--primary-light)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
            }}
          >
            <FolderKanban size={32} />
          </div>
          <h3 style={{ fontSize: "1.3rem", marginBottom: "8px" }}>
            No Projects Found
          </h3>
          <p
            style={{
              color: "var(--text-secondary)",
              marginBottom: "24px",
              fontSize: "0.9rem",
            }}
          >
            You aren't a member of any projects yet. Create your first project
            to get started as an Administrator.
          </p>
          <button
            type="button"
            className="btn btn-primary btn-lg"
            onClick={() => setIsCreateModalOpen(true)}
          >
            <Plus size={18} />
            <span>Create Your First Project</span>
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
