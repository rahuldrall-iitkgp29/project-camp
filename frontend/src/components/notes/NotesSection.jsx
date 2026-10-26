import React, { useState, useEffect, useCallback } from "react";
import { Plus, StickyNote, Edit3, Trash2, Calendar, User } from "lucide-react";
import { notesApi } from "../../api/notes.api.js";
import { Modal } from "../common/Modal.jsx";
import { useToast } from "../../context/ToastContext.jsx";

export const NotesSection = ({ projectId, userRole = "member" }) => {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Note Modal state (Create or Edit)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  const { addToast } = useToast();
  const isAdmin = userRole === "admin";

  const loadNotes = useCallback(async () => {
    if (!projectId) return;
    try {
      const res = await notesApi.getNotes(projectId);
      setNotes(res?.data || []);
    } catch (err) {
      addToast(err.message || "Failed to load project notes", "error");
    } finally {
      setLoading(false);
    }
  }, [projectId, addToast]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  const handleOpenCreate = () => {
    setEditingNoteId(null);
    setContent("");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (note) => {
    setEditingNoteId(note._id);
    setContent(note.content || "");
    setIsModalOpen(true);
  };

  const handleSaveNote = async (e) => {
    e.preventDefault();
    if (!content.trim()) {
      addToast("Note content cannot be empty", "error");
      return;
    }
    if (content.length > 10000) {
      addToast("Note content cannot exceed 10,000 characters", "error");
      return;
    }

    setSaving(true);
    try {
      if (editingNoteId) {
        await notesApi.updateNote(projectId, editingNoteId, content.trim());
        addToast("Note updated successfully", "success");
      } else {
        await notesApi.createNote(projectId, content.trim());
        addToast("Note created successfully", "success");
      }
      setIsModalOpen(false);
      loadNotes();
    } catch (err) {
      addToast(err.message || "Failed to save note", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteNote = async (noteId) => {
    if (!window.confirm("Are you sure you want to delete this note?")) return;

    try {
      await notesApi.deleteNote(projectId, noteId);
      addToast("Note deleted", "info");
      loadNotes();
    } catch (err) {
      addToast(err.message || "Failed to delete note", "error");
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
          <h3 style={{ fontSize: "1.2rem" }}>Project Notes & Documentation</h3>
          <p
            style={{
              fontSize: "0.85rem",
              color: "var(--text-secondary)",
              marginTop: "4px",
            }}
          >
            Shared knowledge, meeting summaries, and notes for all team members.
          </p>
        </div>

        {isAdmin && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleOpenCreate}
          >
            <Plus size={16} />
            <span>New Note</span>
          </button>
        )}
      </div>

      {/* Notes Grid */}
      {loading ? (
        <div
          style={{
            padding: "60px",
            textAlign: "center",
            color: "var(--text-muted)",
          }}
        >
          Loading notes...
        </div>
      ) : notes.length > 0 ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: "20px",
          }}
        >
          {notes.map((note) => {
            const formattedDate = note.createdAt
              ? new Date(note.createdAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : "";

            return (
              <div
                key={note._id}
                className="glass-panel"
                style={{
                  padding: "20px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  backgroundColor: "var(--bg-tertiary)",
                  gap: "16px",
                }}
              >
                {/* Note Content */}
                <div
                  style={{
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    fontSize: "0.9rem",
                    color: "var(--text-primary)",
                    lineHeight: 1.6,
                  }}
                >
                  {note.content}
                </div>

                {/* Footer: Creator & Actions */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingTop: "12px",
                    borderTop: "1px solid var(--border-subtle)",
                    fontSize: "0.78rem",
                    color: "var(--text-muted)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <div
                      className="avatar"
                      style={{
                        width: "22px",
                        height: "22px",
                        fontSize: "0.65rem",
                      }}
                    >
                      {note.createdBy?.username?.charAt(0).toUpperCase() || (
                        <User size={12} />
                      )}
                    </div>
                    <span>{note.createdBy?.username || "Admin"}</span>
                    <span>•</span>
                    <span>{formattedDate}</span>
                  </div>

                  {isAdmin && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(note)}
                        style={{
                          color: "var(--primary-light)",
                          padding: "4px",
                          cursor: "pointer",
                        }}
                        title="Edit note"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteNote(note._id)}
                        style={{
                          color: "var(--danger)",
                          padding: "4px",
                          cursor: "pointer",
                        }}
                        title="Delete note"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div
          className="glass-panel"
          style={{
            padding: "50px 20px",
            textAlign: "center",
            maxWidth: "440px",
            margin: "30px auto",
          }}
        >
          <StickyNote
            size={36}
            color="var(--text-muted)"
            style={{ margin: "0 auto 16px" }}
          />
          <h4 style={{ marginBottom: "6px" }}>No Notes Yet</h4>
          <p
            style={{
              fontSize: "0.85rem",
              color: "var(--text-secondary)",
              marginBottom: "18px",
            }}
          >
            {isAdmin
              ? "Keep team decisions and reference materials organized by writing your first note."
              : "No notes have been published for this project."}
          </p>
          {isAdmin && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleOpenCreate}
            >
              <Plus size={15} />
              <span>Write a Note</span>
            </button>
          )}
        </div>
      )}

      {/* Note Edit/Create Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingNoteId ? "Edit Note" : "Create Note"}
        footer={
          <>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setIsModalOpen(false)}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="note-form"
              className="btn btn-primary"
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : editingNoteId
                  ? "Save Note"
                  : "Create Note"}
            </button>
          </>
        }
      >
        <form id="note-form" onSubmit={handleSaveNote}>
          <label
            style={{
              display: "block",
              marginBottom: "6px",
              fontSize: "0.85rem",
              color: "var(--text-secondary)",
            }}
          >
            Content <span style={{ color: "var(--danger)" }}>*</span>
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            maxLength={10000}
            rows={8}
            placeholder="Type your project notes, architecture decisions, or meeting minutes here..."
          />
          <div
            style={{
              textAlign: "right",
              fontSize: "0.75rem",
              color: "var(--text-muted)",
              marginTop: "4px",
            }}
          >
            {content.length}/10000 characters
          </div>
        </form>
      </Modal>
    </div>
  );
};
