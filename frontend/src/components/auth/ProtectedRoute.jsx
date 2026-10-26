import React, { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { Mail, RefreshCw, Send, CheckCircle2 } from "lucide-react";

export const ProtectedRoute = ({ children, requireVerified = true }) => {
  const { user, loading, isEmailVerified, resendVerification, checkAuth } =
    useAuth();
  const [resending, setResending] = useState(false);
  const [checking, setChecking] = useState(false);
  const location = useLocation();

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "60vh",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div
            style={{
              width: "36px",
              height: "36px",
              border: "3px solid var(--border-medium)",
              borderTopColor: "var(--primary)",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }}
          />
          <span style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
            Loading Project Camp...
          </span>
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If email verification is required for this route (e.g. project workspace) and user is unverified
  if (requireVerified && !isEmailVerified) {
    const handleResend = async () => {
      setResending(true);
      try {
        await resendVerification();
      } finally {
        setResending(false);
      }
    };

    const handleCheckStatus = async () => {
      setChecking(true);
      try {
        await checkAuth();
      } finally {
        setChecking(false);
      }
    };

    return (
      <div
        style={{ maxWidth: "560px", margin: "60px auto", padding: "0 20px" }}
      >
        <div
          className="glass-panel"
          style={{ padding: "36px", textAlign: "center" }}
        >
          <div
            style={{
              width: "60px",
              height: "60px",
              borderRadius: "50%",
              backgroundColor: "var(--warning-bg)",
              color: "var(--warning)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
            }}
          >
            <Mail size={30} />
          </div>

          <h2 style={{ marginBottom: "12px" }}>Email Verification Required</h2>
          <p
            style={{
              color: "var(--text-secondary)",
              marginBottom: "20px",
              lineHeight: 1.6,
            }}
          >
            To access projects, create tasks, and collaborate with your team,
            you must verify your email address:
            <br />
            <strong style={{ color: "var(--text-primary)" }}>
              {user.email}
            </strong>
          </p>

          <p
            style={{
              fontSize: "0.85rem",
              color: "var(--text-muted)",
              marginBottom: "28px",
            }}
          >
            We sent a verification link to your inbox upon registration. Please
            click the link to activate full project capabilities.
          </p>

          <div
            style={{
              display: "flex",
              gap: "12px",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleResend}
              disabled={resending}
            >
              <Send size={16} />
              <span>
                {resending ? "Sending Link..." : "Resend Verification Email"}
              </span>
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleCheckStatus}
              disabled={checking}
            >
              <RefreshCw size={16} className={checking ? "spin" : ""} />
              <span>{checking ? "Checking..." : "I've Verified My Email"}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return children;
};
