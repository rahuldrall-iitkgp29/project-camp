import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
  CheckCircle2,
  AlertCircle,
  Mail,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { authApi } from "../../api/auth.api.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";

export const VerifyEmailPage = () => {
  const { token } = useParams();
  const [manualToken, setManualToken] = useState(token || "");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null); // 'success' | 'error' | null
  const [errorMessage, setErrorMessage] = useState("");

  const { checkAuth, user, isEmailVerified } = useAuth();
  const { addToast } = useToast();

  const handleVerify = async (tokenToUse) => {
    if (!tokenToUse) {
      addToast("Please provide a verification token", "warning");
      return;
    }
    setLoading(true);
    setErrorMessage("");
    try {
      await authApi.verifyEmail(tokenToUse);
      setStatus("success");
      addToast("Email verified successfully!", "success");
      await checkAuth();
    } catch (err) {
      setStatus("error");
      setErrorMessage(err.message || "Invalid or expired verification token.");
      addToast(err.message || "Verification failed", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      handleVerify(token);
    }
  }, [token]);

  return (
    <div style={{ maxWidth: "500px", margin: "60px auto", padding: "0 20px" }}>
      <div
        className="glass-panel"
        style={{ padding: "36px", textAlign: "center" }}
      >
        {status === "success" || isEmailVerified ? (
          <div>
            <div
              style={{
                width: "60px",
                height: "60px",
                borderRadius: "50%",
                backgroundColor: "rgba(16, 185, 129, 0.15)",
                color: "var(--success)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px",
              }}
            >
              <CheckCircle2 size={36} />
            </div>
            <h2 style={{ fontSize: "1.6rem", marginBottom: "12px" }}>
              Email Verified!
            </h2>
            <p
              style={{
                color: "var(--text-secondary)",
                marginBottom: "28px",
                lineHeight: 1.6,
              }}
            >
              Your email has been confirmed. You now have full access to project
              collaboration, task creation, and team management.
            </p>
            <Link
              to="/dashboard"
              className="btn btn-primary btn-lg"
              style={{ width: "100%" }}
            >
              <span>Go to Dashboard</span>
              <ArrowRight size={18} />
            </Link>
          </div>
        ) : (
          <div>
            <div
              style={{
                width: "60px",
                height: "60px",
                borderRadius: "50%",
                backgroundColor:
                  status === "error"
                    ? "rgba(239, 68, 68, 0.15)"
                    : "rgba(99, 102, 241, 0.15)",
                color:
                  status === "error" ? "var(--danger)" : "var(--primary-light)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px",
              }}
            >
              {status === "error" ? (
                <AlertCircle size={32} />
              ) : (
                <Mail size={32} />
              )}
            </div>

            <h2 style={{ fontSize: "1.6rem", marginBottom: "12px" }}>
              Verify Your Email
            </h2>
            <p
              style={{
                color: "var(--text-secondary)",
                marginBottom: "24px",
                lineHeight: 1.6,
              }}
            >
              {errorMessage ||
                "Enter the token received in your verification email or click the link in your message."}
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleVerify(manualToken);
              }}
              style={{ display: "flex", flexDirection: "column", gap: "16px" }}
            >
              <input
                type="text"
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value.trim())}
                placeholder="Paste 40-character verification token"
                required
                style={{
                  textAlign: "center",
                  letterSpacing: "0.05em",
                  fontFamily: "monospace",
                }}
              />

              <button
                type="submit"
                className="btn btn-primary btn-lg"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <RefreshCw size={16} className="spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <span>Verify Email</span>
                )}
              </button>
            </form>

            <div
              style={{
                marginTop: "24px",
                borderTop: "1px solid var(--border-subtle)",
                paddingTop: "16px",
              }}
            >
              <Link
                to="/dashboard"
                style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}
              >
                Return to Dashboard
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
