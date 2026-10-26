import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  Kanban,
  FileText,
  Users,
  Settings,
  ArrowLeft,
  Shield,
  Trash2,
  Save,
  AlertTriangle,
} from "lucide-react";
import { useProject } from "../../context/ProjectContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { TaskBoard } from "../../components/tasks/TaskBoard.jsx";
import { NotesSection } from "../../components/notes/NotesSection.jsx";
import { MemberManagement } from "../../components/projects/MemberManagement.jsx";

export const ProjectDetailPage = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const {
    currentProject,
    currentRole,
    members,
    selectProject,
    refreshMembers,
    updateProject,
    deleteProject,
  } = useProject();

  const [activeTab, setActiveTab] = useState("tasks"); // 'tasks' | 'notes' | 'members' | 'settings'
  const [loading, setLoading] = useState(true);

  // Settings tab form state
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [deleteConfirmationName, setDeleteConfirmationName] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (projectId) {
      setLoading(true);
      selectProject(projectId).finally(() => setLoading(false));
    }
  }, [projectId, selectProject]);

  useEffect(() => {
    if (currentProject) {
      setEditName(currentProject.name || "");
      setEditDescription(currentProject.description || "");
    }
  }, [currentProject]);

  const isAdmin = currentRole === "admin";

  const handleUpdateSettings = async (e) => {
    e.preventDefault();
    if (!editName.trim()) {
      addToast("Project name cannot be empty", "error");
      return;
    }

    setSavingSettings(true);
    try {
      await updateProject(projectId, {
        name: editName.trim(),
        description: editDescription.trim(),
      });
    } catch (err) {
      addToast(err.message || "Failed to update project settings", "error");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleDeleteProject = async () => {
    if (deleteConfirmationName !== currentProject?.name) {
      addToast("Confirmation name does not match project name", "error");
      return;
    }

    setDeleting(true);
    try {
      await deleteProject(projectId);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      addToast(err.message || "Failed to delete project", "error");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "60vh",
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
            Loading project workspace...
          </span>
        </div>
      </div>
    );
  }

  if (!currentProject) {
    return (
      <div
        style={{
          maxWidth: "500px",
          margin: "60px auto",
          textAlign: "center",
          padding: "0 20px",
        }}
      >
        <div className="glass-panel" style={{ padding: "40px" }}>
          <AlertTriangle
            size={36}
            color="var(--warning)"
            style={{ margin: "0 auto 16px" }}
          />
          <h3>Project Not Found</h3>
          <p style={{ color: "var(--text-secondary)", margin: "12px 0 24px" }}>
            The project you requested does not exist or you do not have
            permission to view it.
          </p>
          <Link to="/dashboard" className="btn btn-primary">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "tasks", label: "Tasks", icon: <Kanban size={16} /> },
    { id: "notes", label: "Notes", icon: <FileText size={16} /> },
    { id: "members", label: "Team", icon: <Users size={16} /> },
    ...(isAdmin
      ? [{ id: "settings", label: "Settings", icon: <Settings size={16} /> }]
      : []),
  ];

  return (
    <div
      style={{
        maxWidth: "1280px",
        margin: "0 auto",
        padding: "30px 24px",
        width: "100%",
      }}
    >
      {/* Breadcrumb & Navigation */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "20px",
        }}
      >
        <Link
          to="/dashboard"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            color: "var(--text-muted)",
            fontSize: "0.85rem",
          }}
        >
          <ArrowLeft size={14} />
          <span>Dashboard</span>
        </Link>
        <span style={{ color: "var(--text-disabled)" }}>/</span>
        <span
          style={{
            color: "var(--text-primary)",
            fontSize: "0.85rem",
            fontWeight: 600,
          }}
        >
          {currentProject.name}
        </span>
      </div>

      {/* Project Header Card */}
      <div
        className="glass-panel"
        style={{
          padding: "24px 28px",
          marginBottom: "28px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div style={{ maxWidth: "800px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "8px",
            }}
          >
            <h1 style={{ fontSize: "1.8rem" }}>{currentProject.name}</h1>
            {currentRole && (
              <span className={`badge badge-${currentRole}`}>
                <Shield size={12} />
                <span>{currentRole.replace("_", " ")}</span>
              </span>
            )}
          </div>
          {currentProject.description && (
            <p
              style={{
                color: "var(--text-secondary)",
                fontSize: "0.95rem",
                lineHeight: 1.5,
              }}
            >
              {currentProject.description}
            </p>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          borderBottom: "1px solid var(--border-medium)",
          marginBottom: "28px",
        }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "12px 18px",
                fontSize: "0.92rem",
                fontWeight: 600,
                color: isActive
                  ? "var(--primary-light)"
                  : "var(--text-secondary)",
                borderBottom: isActive
                  ? "2px solid var(--primary)"
                  : "2px solid transparent",
                marginBottom: "-1px",
                cursor: "pointer",
                transition: "all var(--transition-fast)",
                background: "none",
                borderTop: "none",
                borderLeft: "none",
                borderRight: "none",
              }}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content Panes */}
      <div>
        {activeTab === "tasks" && (
          <TaskBoard
            projectId={projectId}
            members={members}
            userRole={currentRole}
          />
        )}

        {activeTab === "notes" && (
          <NotesSection projectId={projectId} userRole={currentRole} />
        )}

        {activeTab === "members" && (
          <MemberManagement
            projectId={projectId}
            members={members}
            userRole={currentRole}
            onMembersChanged={() => refreshMembers(projectId)}
          />
        )}

        {activeTab === "settings" && isAdmin && (
          <div
            style={{
              maxWidth: "680px",
              display: "flex",
              flexDirection: "column",
              gap: "32px",
            }}
          >
            {/* General Project Settings */}
            <div className="glass-panel" style={{ padding: "28px" }}>
              <h3 style={{ marginBottom: "6px" }}>Project Details</h3>
              <p
                style={{
                  fontSize: "0.85rem",
                  color: "var(--text-secondary)",
                  marginBottom: "20px",
                }}
              >
                Update the title and general description of this project.
              </p>

              <form
                onSubmit={handleUpdateSettings}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "6px",
                      fontSize: "0.85rem",
                      color: "var(--text-secondary)",
                    }}
                  >
                    Project Name
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                    maxLength={200}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "6px",
                      fontSize: "0.85rem",
                      color: "var(--text-secondary)",
                    }}
                  >
                    Description
                  </label>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    maxLength={10000}
                    rows={4}
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={savingSettings}
                  >
                    <Save size={16} />
                    <span>{savingSettings ? "Saving..." : "Save Changes"}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Danger Zone: Delete Project */}
            <div
              className="glass-panel"
              style={{
                padding: "28px",
                borderColor: "var(--danger-border)",
                backgroundColor: "var(--bg-card)",
              }}
            >
              <h3 style={{ color: "var(--danger)", marginBottom: "6px" }}>
                Danger Zone
              </h3>
              <p
                style={{
                  fontSize: "0.85rem",
                  color: "var(--text-secondary)",
                  marginBottom: "20px",
                  lineHeight: 1.5,
                }}
              >
                Deleting this project will permanently remove all associated
                tasks, subtasks, notes, team memberships, invitations, and
                uploaded attachments. This action cannot be undone.
              </p>

              <div style={{ marginBottom: "16px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "6px",
                    fontSize: "0.85rem",
                    color: "var(--text-secondary)",
                  }}
                >
                  Type <strong>{currentProject.name}</strong> to confirm
                  deletion:
                </label>
                <input
                  type="text"
                  value={deleteConfirmationName}
                  onChange={(e) => setDeleteConfirmationName(e.target.value)}
                  placeholder={currentProject.name}
                  style={{ borderColor: "var(--danger-border)" }}
                />
              </div>

              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDeleteProject}
                disabled={
                  deleting || deleteConfirmationName !== currentProject.name
                }
              >
                <Trash2 size={16} />
                <span>
                  {deleting
                    ? "Deleting Project..."
                    : "Permanently Delete Project"}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
