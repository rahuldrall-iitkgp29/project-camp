import React, { useState } from "react";
import {
  UserPlus,
  Shield,
  Trash2,
  Mail,
  Calendar,
  AlertCircle,
} from "lucide-react";
import { projectsApi } from "../../api/projects.api.js";
import { Modal } from "../common/Modal.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";

export const MemberManagement = ({
  projectId,
  members = [],
  userRole = "member",
  onMembersChanged,
}) => {
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviting, setInviting] = useState(false);

  const { addToast } = useToast();
  const { user: currentUser } = useAuth();
  const isAdmin = userRole === "admin";

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) {
      addToast("Email is required", "error");
      return;
    }

    setInviting(true);
    try {
      const res = await projectsApi.inviteMember(projectId, {
        email: inviteEmail.trim(),
        role: inviteRole,
      });
      addToast(res?.message || "Invitation sent successfully!", "success");
      setInviteEmail("");
      setInviteRole("member");
      setIsInviteModalOpen(false);
      if (onMembersChanged) onMembersChanged();
    } catch (err) {
      addToast(err.message || "Failed to send invitation", "error");
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (targetUser, newRole) => {
    if (targetUser.role === newRole) return;

    try {
      await projectsApi.updateMemberRole(
        projectId,
        targetUser.user?._id,
        newRole,
      );
      addToast(
        `Updated ${targetUser.user?.username}'s role to ${newRole}`,
        "success",
      );
      if (onMembersChanged) onMembersChanged();
    } catch (err) {
      addToast(
        err.message ||
          "Failed to update role. A project must retain at least one Admin.",
        "error",
      );
      if (onMembersChanged) onMembersChanged(); // Revert local view
    }
  };

  const handleRemoveMember = async (targetUser) => {
    const isSelf = targetUser.user?._id === currentUser?._id;
    const confirmPrompt = isSelf
      ? "Are you sure you want to leave this project?"
      : `Remove member ${targetUser.user?.username} from this project? Their task assignments will be unassigned.`;

    if (!window.confirm(confirmPrompt)) return;

    try {
      await projectsApi.deleteMember(projectId, targetUser.user?._id);
      addToast(`Member removed successfully`, "info");
      if (onMembersChanged) onMembersChanged();
    } catch (err) {
      addToast(
        err.message ||
          "Failed to remove member. A project must retain at least one Admin.",
        "error",
      );
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Header Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div>
          <h3 style={{ fontSize: "1.2rem" }}>
            Team Members ({members.length})
          </h3>
          <p
            style={{
              fontSize: "0.85rem",
              color: "var(--text-secondary)",
              marginTop: "4px",
            }}
          >
            Manage collaborators, assign roles, and invite new members to the
            project.
          </p>
        </div>

        {isAdmin && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setIsInviteModalOpen(true)}
          >
            <UserPlus size={16} />
            <span>Invite Member</span>
          </button>
        )}
      </div>

      {/* Member Table */}
      <div className="glass-panel" style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            textAlign: "left",
            fontSize: "0.9rem",
          }}
        >
          <thead>
            <tr
              style={{
                borderBottom: "1px solid var(--border-medium)",
                color: "var(--text-muted)",
                fontSize: "0.8rem",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              <th style={{ padding: "14px 20px" }}>Member</th>
              <th style={{ padding: "14px 20px" }}>Role</th>
              <th style={{ padding: "14px 20px" }}>Joined</th>
              {isAdmin && (
                <th style={{ padding: "14px 20px", textAlign: "right" }}>
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const joinedDate = m.createdAt
                ? new Date(m.createdAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : "—";

              const isMe = m.user?._id === currentUser?._id;

              return (
                <tr
                  key={m.user?._id || Math.random()}
                  style={{
                    borderBottom: "1px solid var(--border-subtle)",
                    transition: "background-color var(--transition-fast)",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor =
                      "var(--bg-primary)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = "transparent")
                  }
                >
                  {/* User Profile */}
                  <td style={{ padding: "14px 20px" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                      }}
                    >
                      <div
                        className="avatar"
                        style={{
                          width: "32px",
                          height: "32px",
                          fontSize: "0.8rem",
                        }}
                      >
                        {m.user?.username?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div
                          style={{
                            fontWeight: 600,
                            color: "var(--text-primary)",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <span>{m.user?.username}</span>
                          {isMe && (
                            <span
                              style={{
                                fontSize: "0.7rem",
                                color: "var(--primary-light)",
                                padding: "1px 6px",
                                borderRadius: "var(--radius-full)",
                                backgroundColor: "var(--primary-soft)",
                              }}
                            >
                              You
                            </span>
                          )}
                        </div>
                        {m.user?.fullName && (
                          <div
                            style={{
                              fontSize: "0.78rem",
                              color: "var(--text-muted)",
                            }}
                          >
                            {m.user.fullName}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Role Selector / Badge */}
                  <td style={{ padding: "14px 20px" }}>
                    {isAdmin ? (
                      <select
                        value={m.role}
                        onChange={(e) => handleRoleChange(m, e.target.value)}
                        style={{
                          fontSize: "0.82rem",
                          padding: "4px 10px",
                          width: "auto",
                          borderRadius: "var(--radius-sm)",
                        }}
                      >
                        <option value="admin">Admin</option>
                        <option value="project_admin">Project Admin</option>
                        <option value="member">Member</option>
                      </select>
                    ) : (
                      <span className={`badge badge-${m.role}`}>
                        <Shield size={11} />
                        <span>{m.role?.replace("_", " ")}</span>
                      </span>
                    )}
                  </td>

                  {/* Joined Date */}
                  <td
                    style={{
                      padding: "14px 20px",
                      color: "var(--text-muted)",
                      fontSize: "0.85rem",
                    }}
                  >
                    {joinedDate}
                  </td>

                  {/* Actions (Admin Only) */}
                  {isAdmin && (
                    <td style={{ padding: "14px 20px", textAlign: "right" }}>
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(m)}
                        style={{
                          padding: "6px 10px",
                          borderRadius: "var(--radius-sm)",
                          color: "var(--danger)",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          fontSize: "0.8rem",
                          cursor: "pointer",
                        }}
                        title="Remove member from project"
                      >
                        <Trash2 size={14} />
                        <span>Remove</span>
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Invite Member Modal */}
      <Modal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        title="Invite New Team Member"
        footer={
          <>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setIsInviteModalOpen(false)}
              disabled={inviting}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="invite-member-form"
              className="btn btn-primary"
              disabled={inviting}
            >
              {inviting ? "Sending Invitation..." : "Send Invitation"}
            </button>
          </>
        }
      >
        <form
          id="invite-member-form"
          onSubmit={handleInvite}
          style={{ display: "flex", flexDirection: "column", gap: "16px" }}
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
              Member Email Address{" "}
              <span style={{ color: "var(--danger)" }}>*</span>
            </label>
            <div style={{ position: "relative" }}>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
                placeholder="colleague@example.com"
                style={{ paddingLeft: "36px" }}
              />
              <Mail
                size={16}
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--text-muted)",
                }}
              />
            </div>
            <span
              style={{
                fontSize: "0.75rem",
                color: "var(--text-muted)",
                marginTop: "4px",
                display: "block",
              }}
            >
              The recipient will receive an invitation link valid for 7 days.
            </span>
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
              Project Role
            </label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
            >
              <option value="member">
                Member (Can view tasks/notes, mark subtasks complete)
              </option>
              <option value="project_admin">
                Project Admin (Can manage tasks & subtasks, view notes)
              </option>
              <option value="admin">
                Admin (Full project management, notes & team control)
              </option>
            </select>
          </div>
        </form>
      </Modal>
    </div>
  );
};
