import React, { useState } from "react";
import { Modal } from "../common/Modal.jsx";
import { useProject } from "../../context/ProjectContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";

export const CreateProjectModal = ({ isOpen, onClose }) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const { createProject } = useProject();
  const { addToast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      addToast("Project name is required", "error");
      return;
    }
    if (name.length > 200) {
      addToast("Project name cannot exceed 200 characters", "error");
      return;
    }

    setLoading(true);
    try {
      await createProject({
        name: name.trim(),
        description: description.trim(),
      });
      setName("");
      setDescription("");
      onClose();
    } catch (err) {
      addToast(err.message || "Failed to create project", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Project"
      footer={
        <>
          <button
            type="button"
            className="btn btn-outline"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="create-project-form"
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? "Creating..." : "Create Project"}
          </button>
        </>
      }
    >
      <form
        id="create-project-form"
        onSubmit={handleSubmit}
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
            Project Name <span style={{ color: "var(--danger)" }}>*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={200}
            placeholder="e.g. Website Redesign 2026"
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
            Description (Optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={10000}
            placeholder="Describe the scope, goals, and milestones for this project..."
            rows={4}
          />
        </div>
      </form>
    </Modal>
  );
};
