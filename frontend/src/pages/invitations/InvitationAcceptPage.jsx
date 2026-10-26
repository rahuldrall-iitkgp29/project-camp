import React, { useState } from "react";
import { useParams, useNavigate, Link, useLocation } from "react-router-dom";
import {
  Users,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  LogIn,
  UserPlus,
} from "lucide-react";
import { projectsApi } from "../../api/projects.api.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";

export const InvitationAcceptPage = () => {
  const { projectId, token } = useParams();
  const { user, isEmailVerified } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAccept = async () => {
    if (!projectId || !token) {
      addToast("Invalid invitation link parameters", "error");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await projectsApi.acceptInvitation(projectId, token);
      addToast("Invitation accepted! Welcome to the project.", "success");
      navigate(`/projects/${projectId}`, { replace: true });
    } catch (err) {
      const msg =
        err.message ||
        "Failed to accept invitation. The invitation may be expired or already used.";
      setError(msg);
      addToast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "520px", margin: "60px auto", padding: "0 20px" }}>
      <div
        className="glass-panel"
        style={{ padding: "36px", textAlign: "center" }}
      >
        <div
          style={{
            width: "60px",
            height: "60px",
            borderRadius: "var(--radius-lg)",
            background: "var(--primary-gradient)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px",
            boxShadow: "0 4px 16px var(--primary-glow)",
          }}
        >
          <Users size={30} color="white" />
        </div>

        <h2 style={{ fontSize: "1.7rem", marginBottom: "10px" }}>
          Project Invitation
        </h2>
        <p
          style={{
            color: "var(--text-secondary)",
            marginBottom: "24px",
            lineHeight: 1.6,
          }}
        >
          You have been invited to collaborate on a Project Camp project.
        </p>

        {/* If user is not logged in */}
        {!user ? (
          <div>
            <div
              style={{
                padding: "16px",
                backgroundColor: "rgba(99, 102, 241, 0.08)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-subtle)",
                marginBottom: "24px",
                fontSize: "0.9rem",
                color: "var(--text-secondary)",
              }}
            >
              Please log in or register with the{" "}
              <strong>invited email address</strong> to accept this membership.
            </div>

            <div
              style={{ display: "flex", gap: "12px", justifyContent: "center" }}
            >
              <Link
                to="/login"
                state={{ from: location }}
                className="btn btn-primary"
                style={{ flex: 1 }}
              >
                <LogIn size={16} />
                <span>Sign In to Accept</span>
              </Link>
              <Link
                to="/register"
                state={{ from: location }}
                className="btn btn-outline"
                style={{ flex: 1 }}
              >
                <UserPlus size={16} />
                <span>Register</span>
              </Link>
            </div>
          </div>
        ) : !isEmailVerified ? (
          /* User is logged in but unverified */
          <div>
            <div
              style={{
                padding: "16px",
                backgroundColor: "var(--warning-bg)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--warning-border)",
                marginBottom: "20px",
                color: "var(--warning)",
                fontSize: "0.9rem",
              }}
            >
              Your account (<strong>{user.email}</strong>) must be verified
              before accepting project invitations.
            </div>
            <Link to="/dashboard" className="btn btn-secondary">
              Go to Dashboard to Verify Email
            </Link>
          </div>
        ) : (
          /* User is logged in and email verified */
          <div>
            <div
              style={{
                padding: "16px",
                backgroundColor: "rgba(255, 255, 255, 0.03)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-subtle)",
                marginBottom: "24px",
                fontSize: "0.9rem",
              }}
            >
              <div style={{ color: "var(--text-muted)", marginBottom: "4px" }}>
                Signed in as
              </div>
              <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                {user.username} ({user.email})
              </div>
            </div>

            {error && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "12px",
                  backgroundColor: "var(--danger-bg)",
                  color: "var(--danger)",
                  border: "1px solid var(--danger-border)",
                  borderRadius: "var(--radius-md)",
                  marginBottom: "20px",
                  fontSize: "0.85rem",
                  textAlign: "left",
                }}
              >
                <AlertCircle size={18} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            <button
              type="button"
              className="btn btn-primary btn-lg"
              onClick={handleAccept}
              disabled={loading}
              style={{ width: "100%" }}
            >
              {loading ? (
                "Accepting Invitation..."
              ) : (
                <>
                  <span>Accept Project Invitation</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
