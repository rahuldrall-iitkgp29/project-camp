import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ToastProvider } from "./context/ToastContext.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { ProjectProvider } from "./context/ProjectContext.jsx";
import { Navbar } from "./components/common/Navbar.jsx";
import { ProtectedRoute } from "./components/auth/ProtectedRoute.jsx";

// Pages
import { LoginPage } from "./pages/auth/LoginPage.jsx";
import { RegisterPage } from "./pages/auth/RegisterPage.jsx";
import { ForgotPasswordPage } from "./pages/auth/ForgotPasswordPage.jsx";
import { ResetPasswordPage } from "./pages/auth/ResetPasswordPage.jsx";
import { VerifyEmailPage } from "./pages/auth/VerifyEmailPage.jsx";
import { InvitationAcceptPage } from "./pages/invitations/InvitationAcceptPage.jsx";
import { DashboardPage } from "./pages/dashboard/DashboardPage.jsx";
import { ProjectDetailPage } from "./pages/projects/ProjectDetailPage.jsx";
import { NotFoundPage } from "./pages/not-found/NotFoundPage.jsx";

export function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <ProjectProvider>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                minHeight: "100vh",
              }}
            >
              <Navbar />
              <main
                style={{ flex: 1, display: "flex", flexDirection: "column" }}
              >
                <Routes>
                  {/* Public Auth Routes */}
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />
                  <Route
                    path="/forgot-password"
                    element={<ForgotPasswordPage />}
                  />
                  <Route
                    path="/reset-password/:token"
                    element={<ResetPasswordPage />}
                  />
                  <Route
                    path="/verify-email/:token?"
                    element={<VerifyEmailPage />}
                  />

                  {/* Public / Landing Invitation Route (handles auth internally) */}
                  <Route
                    path="/invitations/:projectId/:token"
                    element={<InvitationAcceptPage />}
                  />

                  {/* Protected Collaboration Routes */}
                  <Route
                    path="/dashboard"
                    element={
                      <ProtectedRoute requireVerified={true}>
                        <DashboardPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/projects/:projectId"
                    element={
                      <ProtectedRoute requireVerified={true}>
                        <ProjectDetailPage />
                      </ProtectedRoute>
                    }
                  />

                  {/* Default Navigation */}
                  <Route
                    path="/"
                    element={<Navigate to="/dashboard" replace />}
                  />
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </main>
            </div>
          </ProjectProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}

export default App;
