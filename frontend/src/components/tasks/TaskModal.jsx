import React, { useState, useEffect } from "react";
import { Modal } from "../common/Modal.jsx";
import { tasksApi } from "../../api/tasks.api.js";
import { useToast } from "../../context/ToastContext.jsx";
import {
  CheckSquare,
  Square,
  Plus,
  Trash2,
  Paperclip,
  Upload,
  Download,
  FileText,
  Image as ImageIcon,
  User,
  AlertCircle,
} from "lucide-react";

export const TaskModal = ({
  isOpen,
  onClose,
  projectId,
  taskId, // null if creating a new task
  initialStatus = "todo",
  members = [],
  userRole = "member",
  onTaskUpdated,
}) => {
  const isEditing = !!taskId;
  const canMutateTask = userRole === "admin" || userRole === "project_admin";

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState(initialStatus);
  const [assignedTo, setAssignedTo] = useState("");
  const [attachements, setAttachements] = useState([]);
  const [subtasks, setSubtasks] = useState([]);

  // Subtask creation state
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [addingSubtask, setAddingSubtask] = useState(false);

  // File upload state
  const [selectedFiles, setSelectedFiles] = useState([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const { addToast } = useToast();

  // Load task detail when modal opens for an existing task
  useEffect(() => {
    if (isOpen && taskId) {
      setLoading(true);
      tasksApi
        .getTaskById(projectId, taskId)
        .then((res) => {
          const t = res?.data;
          if (t) {
            setTitle(t.title || "");
            setDescription(t.description || "");
            setStatus(t.status || "todo");
            setAssignedTo(t.assignedTo?._id || "");
            setAttachements(t.attachements || []);
            setSubtasks(t.subtasks || []);
          }
        })
        .catch((err) => {
          addToast(err.message || "Failed to load task details", "error");
        })
        .finally(() => {
          setLoading(false);
        });
    } else if (isOpen && !taskId) {
      // Reset for creation
      setTitle("");
      setDescription("");
      setStatus(initialStatus);
      setAssignedTo("");
      setAttachements([]);
      setSubtasks([]);
      setSelectedFiles([]);
    }
  }, [isOpen, taskId, projectId, initialStatus, addToast]);

  // Handle file selection
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    const allowedTypes = [
      "image/png",
      "image/jpeg",
      "image/gif",
      "image/webp",
      "application/pdf",
    ];
    const maxBytes = 1000000; // 1 MB

    const currentTotalCount =
      attachements.length + selectedFiles.length + files.length;
    if (currentTotalCount > 5) {
      addToast(
        `A task supports at most 5 attachments (currently ${attachements.length + selectedFiles.length})`,
        "error",
      );
      return;
    }

    for (const file of files) {
      if (!allowedTypes.includes(file.type)) {
        addToast(
          `File ${file.name} is not an allowed type (PNG, JPEG, GIF, WebP, PDF only)`,
          "error",
        );
        return;
      }
      if (file.size > maxBytes) {
        addToast(
          `File ${file.name} exceeds 1MB limit (${(file.size / 1024 / 1024).toFixed(2)} MB)`,
          "error",
        );
        return;
      }
    }

    setSelectedFiles((prev) => [...prev, ...files]);
  };

  const removeSelectedFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Toggle Subtask Completion (Allowed for ALL project roles including Member)
  const handleToggleSubtask = async (subtask) => {
    try {
      const nextCompleted = !subtask.isCompleted;
      const res = await tasksApi.updateSubtask(projectId, subtask._id, {
        isCompleted: nextCompleted,
      });
      setSubtasks((prev) =>
        prev.map((st) =>
          st._id === subtask._id ? { ...st, isCompleted: nextCompleted } : st,
        ),
      );
      if (onTaskUpdated) onTaskUpdated();
    } catch (err) {
      addToast(err.message || "Failed to update subtask completion", "error");
    }
  };

  // Add Subtask (Admin / Project Admin)
  const handleAddSubtask = async (e) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim()) return;

    setAddingSubtask(true);
    try {
      const res = await tasksApi.createSubtask(projectId, taskId, {
        title: newSubtaskTitle.trim(),
      });
      const created = res?.data;
      setSubtasks((prev) => [...prev, created]);
      setNewSubtaskTitle("");
      addToast("Subtask added", "success");
      if (onTaskUpdated) onTaskUpdated();
    } catch (err) {
      addToast(err.message || "Failed to add subtask", "error");
    } finally {
      setAddingSubtask(false);
    }
  };

  // Delete Subtask (Admin / Project Admin)
  const handleDeleteSubtask = async (subtaskId) => {
    try {
      await tasksApi.deleteSubtask(projectId, subtaskId);
      setSubtasks((prev) => prev.filter((st) => st._id !== subtaskId));
      addToast("Subtask removed", "info");
      if (onTaskUpdated) onTaskUpdated();
    } catch (err) {
      addToast(err.message || "Failed to delete subtask", "error");
    }
  };

  // Save Task (Create or Update)
  const handleSave = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      addToast("Task title is required", "error");
      return;
    }

    setSaving(true);
    try {
      // Build FormData if attachments or update has files
      let payload;
      if (selectedFiles.length > 0) {
        payload = new FormData();
        payload.append("title", title.trim());
        if (description) payload.append("description", description.trim());
        payload.append("status", status);
        // Note: if assignedTo is empty, don't append or append null
        if (assignedTo) {
          payload.append("assignedTo", assignedTo);
        } else if (isEditing) {
          payload.append("assignedTo", null);
        }
        selectedFiles.forEach((file) => {
          payload.append("attachements", file);
        });
      } else {
        payload = {
          title: title.trim(),
          description: description.trim(),
          status,
          assignedTo: assignedTo || null,
        };
      }

      if (isEditing) {
        await tasksApi.updateTask(projectId, taskId, payload);
        addToast("Task updated successfully", "success");
      } else {
        await tasksApi.createTask(projectId, payload);
        addToast("Task created successfully", "success");
      }

      if (onTaskUpdated) onTaskUpdated();
      onClose();
    } catch (err) {
      addToast(err.message || "Failed to save task", "error");
    } finally {
      setSaving(false);
    }
  };

  // Delete Task (Admin / Project Admin)
  const handleDeleteTask = async () => {
    if (!window.confirm(`Are you sure you want to delete task "${title}"?`))
      return;

    setSaving(true);
    try {
      await tasksApi.deleteTask(projectId, taskId);
      addToast("Task deleted", "info");
      if (onTaskUpdated) onTaskUpdated();
      onClose();
    } catch (err) {
      addToast(err.message || "Failed to delete task", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        isEditing
          ? canMutateTask
            ? "Edit Task"
            : "Task Details"
          : "Create New Task"
      }
      maxWidth="680px"
      footer={
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            width: "100%",
            alignItems: "center",
          }}
        >
          <div>
            {isEditing && canMutateTask && (
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={handleDeleteTask}
                disabled={saving}
              >
                <Trash2 size={15} />
                <span>Delete Task</span>
              </button>
            )}
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={onClose}
              disabled={saving}
            >
              {canMutateTask ? "Cancel" : "Close"}
            </button>
            {canMutateTask && (
              <button
                type="submit"
                form="task-form"
                className="btn btn-primary"
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : isEditing
                    ? "Save Changes"
                    : "Create Task"}
              </button>
            )}
          </div>
        </div>
      }
    >
      {loading ? (
        <div
          style={{
            padding: "40px",
            textAlign: "center",
            color: "var(--text-muted)",
          }}
        >
          Loading task details...
        </div>
      ) : (
        <form
          id="task-form"
          onSubmit={handleSave}
          style={{ display: "flex", flexDirection: "column", gap: "20px" }}
        >
          {/* Title */}
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "6px",
                fontSize: "0.85rem",
                color: "var(--text-secondary)",
              }}
            >
              Title <span style={{ color: "var(--danger)" }}>*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={200}
              placeholder="e.g. Implement user authentication"
              disabled={!canMutateTask}
            />
          </div>

          {/* Status and Assignee Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
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
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                disabled={!canMutateTask}
              >
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
              </select>
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
                Assignee
              </label>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                disabled={!canMutateTask}
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.user?._id} value={m.user?._id}>
                    {m.user?.username} ({m.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
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
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={10000}
              placeholder="Provide context, acceptance criteria, or relevant technical details..."
              rows={3}
              disabled={!canMutateTask}
            />
          </div>

          {/* Subtasks Section (Visible in Edit mode) */}
          {isEditing && (
            <div
              style={{
                borderTop: "1px solid var(--border-subtle)",
                paddingTop: "16px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "12px",
                }}
              >
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: "0.95rem",
                    color: "var(--text-primary)",
                  }}
                >
                  Subtasks Checklist (
                  {subtasks.filter((st) => st.isCompleted).length}/
                  {subtasks.length})
                </div>
              </div>

              {/* Subtasks List */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  marginBottom: "12px",
                }}
              >
                {subtasks.map((st) => (
                  <div
                    key={st._id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      backgroundColor: "rgba(255, 255, 255, 0.03)",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => handleToggleSubtask(st)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        background: "none",
                        border: "none",
                        color: st.isCompleted
                          ? "var(--text-muted)"
                          : "var(--text-primary)",
                        textDecoration: st.isCompleted
                          ? "line-through"
                          : "none",
                        cursor: "pointer",
                        textAlign: "left",
                        flex: 1,
                      }}
                    >
                      {st.isCompleted ? (
                        <CheckSquare size={17} color="var(--success)" />
                      ) : (
                        <Square size={17} color="var(--text-muted)" />
                      )}
                      <span>{st.title}</span>
                    </button>

                    {canMutateTask && (
                      <button
                        type="button"
                        onClick={() => handleDeleteSubtask(st._id)}
                        style={{
                          color: "var(--danger)",
                          padding: "4px",
                          cursor: "pointer",
                        }}
                        title="Delete subtask"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}

                {subtasks.length === 0 && (
                  <div
                    style={{
                      fontSize: "0.85rem",
                      color: "var(--text-muted)",
                      fontStyle: "italic",
                    }}
                  >
                    No subtasks created yet.
                  </div>
                )}
              </div>

              {/* Add Subtask Input (Admin/Project Admin) */}
              {canMutateTask && (
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    type="text"
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    placeholder="Add a new subtask..."
                    maxLength={200}
                    style={{ fontSize: "0.85rem", padding: "8px 12px" }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddSubtask(e);
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleAddSubtask}
                    disabled={addingSubtask || !newSubtaskTitle.trim()}
                  >
                    <Plus size={16} />
                    <span>Add</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Attachments Section */}
          <div
            style={{
              borderTop: "1px solid var(--border-subtle)",
              paddingTop: "16px",
            }}
          >
            <div
              style={{
                fontWeight: 600,
                fontSize: "0.95rem",
                color: "var(--text-primary)",
                marginBottom: "12px",
              }}
            >
              Attachments ({attachements.length + selectedFiles.length}/5)
            </div>

            {/* Existing Attachments */}
            {attachements.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  marginBottom: "16px",
                }}
              >
                {attachements.map((att, idx) => {
                  const isImage = att.mimeTypes?.startsWith("image/");
                  return (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px 12px",
                        backgroundColor: "rgba(255, 255, 255, 0.03)",
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--border-subtle)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                        }}
                      >
                        {isImage ? (
                          <ImageIcon size={18} color="var(--primary-light)" />
                        ) : (
                          <FileText size={18} color="var(--info)" />
                        )}
                        <span
                          style={{
                            fontSize: "0.85rem",
                            color: "var(--text-primary)",
                          }}
                        >
                          Attachment {idx + 1} (
                          {att.mimeTypes?.split("/")[1]?.toUpperCase() ||
                            "FILE"}
                          )
                        </span>
                        <span
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--text-muted)",
                          }}
                        >
                          {(att.size / 1024).toFixed(0)} KB
                        </span>
                      </div>

                      <a
                        href={att.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-outline btn-sm"
                        style={{
                          padding: "4px 8px",
                          fontSize: "0.75rem",
                          gap: "4px",
                        }}
                      >
                        <Download size={13} />
                        <span>Download</span>
                      </a>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Selected New Files Preview */}
            {selectedFiles.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  marginBottom: "12px",
                }}
              >
                <span
                  style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}
                >
                  Pending Uploads:
                </span>
                {selectedFiles.map((file, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "6px 10px",
                      backgroundColor: "rgba(99, 102, 241, 0.1)",
                      borderRadius: "var(--radius-sm)",
                      border: "1px dashed var(--primary)",
                      fontSize: "0.82rem",
                    }}
                  >
                    <span>
                      {file.name} ({(file.size / 1024).toFixed(0)} KB)
                    </span>
                    <button
                      type="button"
                      onClick={() => removeSelectedFile(i)}
                      style={{ color: "var(--danger)", cursor: "pointer" }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Upload Dropzone (Admin / Project Admin) */}
            {canMutateTask &&
              attachements.length + selectedFiles.length < 5 && (
                <div>
                  <label
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      padding: "20px",
                      border: "1px dashed var(--border-medium)",
                      borderRadius: "var(--radius-md)",
                      cursor: "pointer",
                      backgroundColor: "rgba(255, 255, 255, 0.02)",
                      transition: "border-color var(--transition-fast)",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.borderColor = "var(--primary)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.borderColor =
                        "var(--border-medium)")
                    }
                  >
                    <Upload size={20} color="var(--primary-light)" />
                    <span
                      style={{
                        fontSize: "0.85rem",
                        color: "var(--text-primary)",
                        fontWeight: 500,
                      }}
                    >
                      Click to attach files (PNG, JPEG, GIF, WebP, PDF)
                    </span>
                    <span
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--text-muted)",
                      }}
                    >
                      Max 1MB per file • Up to 5 files total per task
                    </span>
                    <input
                      type="file"
                      multiple
                      accept=".png,.jpg,.jpeg,.gif,.webp,.pdf"
                      onChange={handleFileChange}
                      style={{ display: "none" }}
                    />
                  </label>
                </div>
              )}
          </div>
        </form>
      )}
    </Modal>
  );
};
