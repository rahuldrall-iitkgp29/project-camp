import React, { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Lock, ArrowRight, CheckCircle2 } from "lucide-react";
import { authApi } from "../../api/auth.api.js";
import { useToast } from "../../context/ToastContext.jsx";

export const ResetPasswordPage = () => {
  const { token } = useParams();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  const { addToast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!token) {
      addToast("Missing password reset token", "error");
      return;
    }
    if (newPassword.length < 6) {
      addToast("Password must be at least 6 characters", "error");
      return;
    }
    if (newPassword !== confirmPassword) {
      addToast("Passwords do not match", "error");
      return;
    }

    setLoading(true);
    try {
      await authApi.resetPassword(token, newPassword);
      setResetSuccess(true);
      addToast("Password has been reset successfully!", "success");
    } catch (err) {
      addToast(
        err.message || "Failed to reset password. The link may have expired.",
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  if (resetSuccess) {
    return (
      <div
        style={{ maxWidth: "440px", margin: "60px auto", padding: "0 20px" }}
      >
        <div
          className="glass-panel"
          style={{ padding: "36px", textAlign: "center" }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              backgroundColor: "var(--success-bg)",
              color: "var(--success)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
            }}
          >
            <CheckCircle2 size={32} />
          </div>
          <h2 style={{ fontSize: "1.6rem", marginBottom: "12px" }}>
            Password Reset!
          </h2>
          <p
            style={{
              color: "var(--text-secondary)",
              marginBottom: "28px",
              lineHeight: 1.6,
            }}
          >
            Your account password has been updated. You can now log in with your
            new credentials.
          </p>
          <Link
            to="/login"
            className="btn btn-primary btn-lg"
            style={{ width: "100%" }}
          >
            <span>Sign In</span>
            <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "440px", margin: "60px auto", padding: "0 20px" }}>
      <div className="glass-panel" style={{ padding: "36px" }}>
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "var(--radius-md)",
              background: "var(--primary-soft)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
              color: "var(--primary)",
            }}
          >
            <Lock size={24} color="var(--primary)" />
          </div>
          <h2 style={{ fontSize: "1.6rem" }}>Set New Password</h2>
          <p
            style={{
              fontSize: "0.9rem",
              color: "var(--text-secondary)",
              marginTop: "6px",
            }}
          >
            Create a strong, secure password for your account
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "18px" }}
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
              New Password (minimum 6 characters)
            </label>
            <div style={{ position: "relative" }}>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                placeholder="••••••••"
                style={{ paddingLeft: "38px" }}
              />
              <Lock
                size={18}
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--text-muted)",
                }}
              />
            </div>
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
              Confirm Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="••••••••"
                style={{ paddingLeft: "38px" }}
              />
              <Lock
                size={18}
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--text-muted)",
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={loading}
            style={{ width: "100%", marginTop: "8px" }}
          >
            {loading ? "Resetting Password..." : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
};
