import { apiClient } from "./client.js";

export const authApi = {
  register: (data) =>
    apiClient("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  login: (data) =>
    apiClient("/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  logout: () =>
    apiClient("/auth/logout", {
      method: "POST",
    }),

  getCurrentUser: () =>
    apiClient("/auth/current-user", {
      method: "GET",
    }),

  changePassword: (data) =>
    apiClient("/auth/change-password", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  verifyEmail: (verficationToken) =>
    apiClient(`/auth/verify-email/${verficationToken}`, {
      method: "GET",
    }),

  resendVerification: () =>
    apiClient("/auth/resend-email-verification", {
      method: "POST",
    }),

  forgotPassword: (email) =>
    apiClient("/auth/forgot-Password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  resetPassword: (resetToken, newPassword) =>
    apiClient(`/auth/reset-password/${resetToken}`, {
      method: "POST",
      body: JSON.stringify({ newPassword }),
    }),
};
