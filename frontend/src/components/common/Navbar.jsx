import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Layers,
  LogOut,
  KeyRound,
  AlertTriangle,
  User,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import { ChangePasswordModal } from "./ChangePasswordModal.jsx";

export const Navbar = () => {
  const { user, isEmailVerified, logout, resendVerification } = useAuth();
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [resending, setResending] = useState(false);

  const navigate = useNavigate();

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
        className="app-navbar"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          backgroundColor: "var(--bg-secondary)",
          borderBottom: "1px solid var(--border-subtle)",
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
              fontWeight: 600,
              fontSize: "1.1rem",
              letterSpacing: "-0.02em",
            }}
          >
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "var(--radius-md)",
                background: "var(--bg-tertiary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Layers size={20} color="var(--primary)" />
            </div>
            <span>Project Camp</span>
          </Link>

        </div>

        {/* Right: User State / Navigation */}
        <div className="navbar-actions">
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
                      color: "var(--warning)",
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
                    borderRadius: "var(--radius-md)",
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
                      backgroundColor: "var(--bg-card)",
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
                          "var(--bg-tertiary)")
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
                          "var(--danger-bg)")
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
                Sign Up
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
