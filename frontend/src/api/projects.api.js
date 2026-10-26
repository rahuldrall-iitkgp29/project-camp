import { apiClient } from "./client.js";

export const projectsApi = {
  getProjects: () =>
    apiClient("/projects", {
      method: "GET",
    }),

  createProject: (data) =>
    apiClient("/projects", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getProjectById: (projectId) =>
    apiClient(`/projects/${projectId}`, {
      method: "GET",
    }),

  updateProject: (projectId, data) =>
    apiClient(`/projects/${projectId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteProject: (projectId) =>
    apiClient(`/projects/${projectId}`, {
      method: "DELETE",
    }),

  getMembers: (projectId) =>
    apiClient(`/projects/${projectId}/members`, {
      method: "GET",
    }),

  inviteMember: (projectId, data) =>
    apiClient(`/projects/${projectId}/members`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateMemberRole: (projectId, userId, newRole) =>
    apiClient(`/projects/${projectId}/members/${userId}`, {
      method: "PUT",
      body: JSON.stringify({ newRole }),
    }),

  deleteMember: (projectId, userId) =>
    apiClient(`/projects/${projectId}/members/${userId}`, {
      method: "DELETE",
    }),

  acceptInvitation: (projectId, invitationToken) =>
    apiClient(`/projects/${projectId}/invitations/${invitationToken}/accept`, {
      method: "POST",
    }),
};
