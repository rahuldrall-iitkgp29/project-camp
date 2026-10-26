import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Layers,
  LogOut,
  KeyRound,
  AlertTriangle,
  CheckCircle,
  Activity,
  User,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import { healthApi } from "../../api/health.api.js";
import { ChangePasswordModal } from "./ChangePasswordModal.jsx";

export const Navbar = () => {
  const { user, isEmailVerified, logout, resendVerification } = useAuth();
  const [isHealthOnline, setIsHealthOnline] = useState(null);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [resending, setResending] = useState(false);

  const navigate = useNavigate();

  // Check health on mount
  useEffect(() => {
    let isMounted = true;
    healthApi
      .check()
      .then(() => {
        if (isMounted) setIsHealthOnline(true);
      })
      .catch(() => {
        if (isMounted) setIsHealthOnline(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await resendVerification();
    } finally {
      setResending(false);
    }
  };

  return (
    <>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          backgroundColor: "rgba(10, 13, 20, 0.8)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderBottom: "1px solid var(--border-subtle)",
          padding: "0 1.5rem",
          height: "64px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Left: Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <Link
            to={user ? "/dashboard" : "/login"}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              color: "var(--text-primary)",
              fontWeight: 800,
              fontSize: "1.2rem",
              letterSpacing: "-0.02em",
            }}
          >
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "var(--radius-md)",
                background: "var(--primary-gradient)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 2px 10px var(--primary-glow)",
              }}
            >
              <Layers size={20} color="white" />
            </div>
            <span>Project Camp</span>
          </Link>

          {/* Health status badge */}
          <div
            title={
              isHealthOnline
                ? "API is connected and healthy"
                : "API status: checking / unreachable"
            }
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "3px 8px",
              borderRadius: "var(--radius-full)",
              backgroundColor: "rgba(255, 255, 255, 0.04)",
              border: "1px solid var(--border-subtle)",
              fontSize: "0.75rem",
              color: "var(--text-muted)",
            }}
          >
            <span
              style={{
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                backgroundColor:
                  isHealthOnline === true
                    ? "var(--success)"
                    : isHealthOnline === false
                      ? "var(--danger)"
                      : "var(--warning)",
                boxShadow:
                  isHealthOnline === true ? "0 0 8px var(--success)" : "none",
              }}
            />
            <span>
              {isHealthOnline
                ? "API Online"
                : isHealthOnline === false
                  ? "API Offline"
                  : "Connecting..."}
            </span>
          </div>
        </div>

        {/* Right: User State / Navigation */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          {user ? (
            <>
              {/* Email verification reminder if unverified */}
              {!isEmailVerified && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "4px 10px",
                    backgroundColor: "var(--warning-bg)",
                    border: "1px solid var(--warning-border)",
                    borderRadius: "var(--radius-md)",
                    fontSize: "0.8rem",
                    color: "var(--warning)",
                  }}
                >
                  <AlertTriangle size={14} />
                  <span>Email unverified</span>
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resending}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#fbbf24",
                      textDecoration: "underline",
                      cursor: "pointer",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                    }}
                  >
                    {resending ? "Sending..." : "Resend Email"}
                  </button>
                </div>
              )}

              {/* User profile menu */}
              <div style={{ position: "relative" }}>
                <button
                  type="button"
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "5px 12px 5px 6px",
                    backgroundColor: "var(--bg-tertiary)",
                    border: "1px solid var(--border-medium)",
                    borderRadius: "var(--radius-full)",
                    cursor: "pointer",
                  }}
                  aria-expanded={isUserMenuOpen}
                >
                  <div
                    className="avatar"
                    style={{
                      width: "28px",
                      height: "28px",
                      fontSize: "0.75rem",
                    }}
                  >
                    {user.username?.charAt(0).toUpperCase() || (
                      <User size={14} />
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      color: "var(--text-primary)",
                    }}
                  >
                    {user.username}
                  </span>
                </button>

                {/* Dropdown panel */}
                {isUserMenuOpen && (
                  <div
                    style={{
                      position: "absolute",
                      right: 0,
                      top: "calc(100% + 8px)",
                      width: "220px",
                      backgroundColor: "#131929",
                      border: "1px solid var(--border-medium)",
                      borderRadius: "var(--radius-md)",
                      boxShadow: "var(--shadow-lg)",
                      padding: "8px 0",
                      zIndex: 100,
                      animation: "fadeIn 120ms ease-out",
                    }}
                  >
                    <div
                      style={{
                        padding: "8px 16px",
                        borderBottom: "1px solid var(--border-subtle)",
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 600,
                          color: "var(--text-primary)",
                          fontSize: "0.9rem",
                        }}
                      >
                        {user.fullName || user.username}
                      </div>
                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: "var(--text-muted)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {user.email}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        setIsPasswordModalOpen(true);
                      }}
                      style={{
                        width: "100%",
                        padding: "10px 16px",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        color: "var(--text-primary)",
                        fontSize: "0.85rem",
                        cursor: "pointer",
                        transition: "background var(--transition-fast)",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.backgroundColor =
                          "rgba(255, 255, 255, 0.05)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.backgroundColor = "transparent")
                      }
                    >
                      <KeyRound size={15} color="var(--primary-light)" />
                      <span>Change Password</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        handleLogout();
                      }}
                      style={{
                        width: "100%",
                        padding: "10px 16px",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        color: "var(--danger)",
                        fontSize: "0.85rem",
                        cursor: "pointer",
                        borderTop: "1px solid var(--border-subtle)",
                        transition: "background var(--transition-fast)",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.backgroundColor =
                          "rgba(239, 68, 68, 0.08)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.backgroundColor = "transparent")
                      }
                    >
                      <LogOut size={15} />
                      <span>Log Out</span>
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <Link to="/login" className="btn btn-outline btn-sm">
                Log In
              </Link>
              <Link to="/register" className="btn btn-primary btn-sm">
                Get Started
              </Link>
            </div>
          )}
        </div>
      </header>

      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
      />
    </>
  );
};
