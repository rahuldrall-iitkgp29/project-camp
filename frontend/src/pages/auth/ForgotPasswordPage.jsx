import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  KeyRound,
  ArrowRight,
  ArrowLeft,
  Mail,
  CheckCircle2,
} from "lucide-react";
import { authApi } from "../../api/auth.api.js";
import { useToast } from "../../context/ToastContext.jsx";

export const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const { addToast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authApi.forgotPassword(email);
      setSubmitted(true);
      addToast("Password reset instructions dispatched", "info");
    } catch (err) {
      addToast(err.message || "Failed to submit request", "error");
    } finally {
      setLoading(false);
    }
  };

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
              color: "var(--primary-light)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
            }}
          >
            <KeyRound size={24} />
          </div>
          <h2 style={{ fontSize: "1.6rem" }}>Reset Password</h2>
          <p
            style={{
              fontSize: "0.9rem",
              color: "var(--text-secondary)",
              marginTop: "6px",
            }}
          >
            Enter your email to receive a password reset link
          </p>
        </div>

        {submitted ? (
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                backgroundColor: "var(--success-bg)",
                color: "var(--success)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
              }}
            >
              <CheckCircle2 size={24} />
            </div>
            <p
              style={{
                color: "var(--text-secondary)",
                marginBottom: "24px",
                lineHeight: 1.6,
              }}
            >
              If an account is associated with <strong>{email}</strong>, you
              will receive a reset email shortly with a secure link.
            </p>
            <Link
              to="/login"
              className="btn btn-primary"
              style={{ width: "100%" }}
            >
              <ArrowLeft size={16} />
              <span>Back to Sign In</span>
            </Link>
          </div>
        ) : (
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
                Email Address
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="name@example.com"
                  style={{ paddingLeft: "38px" }}
                />
                <Mail
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
              {loading ? (
                "Sending Link..."
              ) : (
                <>
                  <span>Send Reset Link</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>

            <div style={{ textAlign: "center", marginTop: "12px" }}>
              <Link
                to="/login"
                style={{
                  fontSize: "0.85rem",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <ArrowLeft size={14} />
                <span>Back to Sign In</span>
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
