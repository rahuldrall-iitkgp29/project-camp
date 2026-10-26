import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  UserPlus,
  ArrowRight,
  Mail,
  Lock,
  User,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";

export const RegisterPage = () => {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [registeredSuccess, setRegisteredSuccess] = useState(false);

  const { register } = useAuth();
  const { addToast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Client validations
    const cleanUsername = username.trim().toLowerCase();
    if (cleanUsername.length < 3 || cleanUsername.length > 20) {
      addToast("Username must be between 3 and 20 characters", "error");
      return;
    }
    if (password.length < 6) {
      addToast("Password must be at least 6 characters", "error");
      return;
    }

    setLoading(true);
    try {
      await register(cleanUsername, email, password);
      setRegisteredSuccess(true);
    } catch (err) {
      addToast(err.message || "Registration failed", "error");
    } finally {
      setLoading(false);
    }
  };

  if (registeredSuccess) {
    return (
      <div
        style={{ maxWidth: "480px", margin: "60px auto", padding: "0 20px" }}
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
            Account Created!
          </h2>
          <p
            style={{
              color: "var(--text-secondary)",
              marginBottom: "20px",
              lineHeight: 1.6,
            }}
          >
            We've sent a verification email to:
            <br />
            <strong style={{ color: "var(--text-primary)" }}>{email}</strong>
          </p>

          <p
            style={{
              fontSize: "0.85rem",
              color: "var(--text-muted)",
              marginBottom: "28px",
            }}
          >
            Please check your inbox and confirm your email. You can log in right
            now to browse your account.
          </p>

          <Link
            to="/login"
            className="btn btn-primary btn-lg"
            style={{ width: "100%" }}
          >
            <span>Continue to Sign In</span>
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
            <UserPlus size={24} color="var(--primary)" />
          </div>
          <h2 style={{ fontSize: "1.6rem" }}>Create Account</h2>
          <p
            style={{
              fontSize: "0.9rem",
              color: "var(--text-secondary)",
              marginTop: "6px",
            }}
          >
            Start collaborating with your team today
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
              Username (lowercase, 3-20 characters)
            </label>
            <div style={{ position: "relative" }}>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                required
                minLength={3}
                maxLength={20}
                placeholder="johndoe"
                style={{ paddingLeft: "38px" }}
              />
              <User
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

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "6px",
                fontSize: "0.85rem",
                color: "var(--text-secondary)",
              }}
            >
              Password (minimum 6 characters)
            </label>
            <div style={{ position: "relative" }}>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={loading}
            style={{ width: "100%", marginTop: "8px" }}
          >
            {loading ? (
              "Creating Account..."
            ) : (
              <>
                <span>Sign Up</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <div
          style={{
            textAlign: "center",
            marginTop: "24px",
            paddingTop: "20px",
            borderTop: "1px solid var(--border-subtle)",
          }}
        >
          <p style={{ fontSize: "0.85rem" }}>
            Already have an account?{" "}
            <Link to="/login" style={{ fontWeight: 600 }}>
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
