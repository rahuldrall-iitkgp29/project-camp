import { apiClient } from "./client.js";

export const tasksApi = {
  getTasks: (projectId) =>
    apiClient(`/tasks/${projectId}`, {
      method: "GET",
    }),

  getTaskById: (projectId, taskId) =>
    apiClient(`/tasks/${projectId}/t/${taskId}`, {
      method: "GET",
    }),

  createTask: (projectId, payload) => {
    const isFormData = payload instanceof FormData;
    return apiClient(`/tasks/${projectId}`, {
      method: "POST",
      body: isFormData ? payload : JSON.stringify(payload),
    });
  },

  updateTask: (projectId, taskId, payload) => {
    const isFormData = payload instanceof FormData;
    return apiClient(`/tasks/${projectId}/t/${taskId}`, {
      method: "PUT",
      body: isFormData ? payload : JSON.stringify(payload),
    });
  },

  deleteTask: (projectId, taskId) =>
    apiClient(`/tasks/${projectId}/t/${taskId}`, {
      method: "DELETE",
    }),

  createSubtask: (projectId, taskId, data) =>
    apiClient(`/tasks/${projectId}/t/${taskId}/subtasks`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateSubtask: (projectId, subTaskId, data) =>
    apiClient(`/tasks/${projectId}/st/${subTaskId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteSubtask: (projectId, subTaskId) =>
    apiClient(`/tasks/${projectId}/st/${subTaskId}`, {
      method: "DELETE",
    }),
};
