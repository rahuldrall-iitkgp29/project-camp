import { apiClient } from "./client.js";

export const notesApi = {
  getNotes: (projectId) =>
    apiClient(`/notes/${projectId}`, {
      method: "GET",
    }),

  getNoteById: (projectId, noteId) =>
    apiClient(`/notes/${projectId}/n/${noteId}`, {
      method: "GET",
    }),

  createNote: (projectId, content) =>
    apiClient(`/notes/${projectId}`, {
      method: "POST",
      body: JSON.stringify({ content }),
    }),

  updateNote: (projectId, noteId, content) =>
    apiClient(`/notes/${projectId}/n/${noteId}`, {
      method: "PUT",
      body: JSON.stringify({ content }),
    }),

  deleteNote: (projectId, noteId) =>
    apiClient(`/notes/${projectId}/n/${noteId}`, {
      method: "DELETE",
    }),
};
