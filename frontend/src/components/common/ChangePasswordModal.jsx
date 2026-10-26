import React, { useState } from "react";
import { Modal } from "./Modal.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";

export const ChangePasswordModal = ({ isOpen, onClose }) => {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const { changePassword } = useAuth();
  const { addToast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (newPassword.length < 6) {
      addToast("New password must be at least 6 characters", "error");
      return;
    }
    if (newPassword !== confirmPassword) {
      addToast("New passwords do not match", "error");
      return;
    }

    setLoading(true);
    try {
      await changePassword(oldPassword, newPassword);
      onClose();
      // Auth context clears user because all sessions are revoked on password change
    } catch (err) {
      addToast(err.message || "Failed to change password", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Change Password"
      footer={
        <>
          <button
            type="button"
            className="btn btn-outline"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="change-password-form"
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? "Updating..." : "Update Password"}
          </button>
        </>
      }
    >
      <form
        id="change-password-form"
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "16px" }}
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
            Current Password
          </label>
          <input
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            required
            placeholder="Enter current password"
          />
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
            New Password (minimum 6 characters)
          </label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={6}
            placeholder="Enter new password"
          />
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
            Confirm New Password
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            placeholder="Confirm new password"
          />
        </div>
      </form>
    </Modal>
  );
};
