import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { authApi } from "../api/auth.api.js";
import { setAuthExpiredHandler } from "../api/client.js";
import { useToast } from "./ToastContext.jsx";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  const checkAuth = useCallback(async () => {
    try {
      const res = await authApi.getCurrentUser();
      // Backend returns public user in data
      const userData = res?.data || null;
      setUser(userData);
      return userData;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();

    // Listen for auth expiration events from apiClient
    setAuthExpiredHandler(() => {
      setUser(null);
      addToast("Your session has expired. Please log in again.", "warning");
    });
  }, [checkAuth, addToast]);

  const login = async (email, password) => {
    const res = await authApi.login({ email, password });
    const loggedInUser = res?.data?.user;
    setUser(loggedInUser);
    addToast(`Welcome back, ${loggedInUser?.username || "user"}!`, "success");
    return loggedInUser;
  };

  const register = async (username, email, password) => {
    const res = await authApi.register({ username, email, password });
    addToast(
      res?.message || "Registration successful! Please verify your email.",
      "success",
    );
    return res?.data;
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore errors on logout
    } finally {
      setUser(null);
      addToast("You have been logged out.", "info");
    }
  };

  const resendVerification = async () => {
    const res = await authApi.resendVerification();
    addToast(res?.message || "Verification email sent!", "success");
    return res;
  };

  const changePassword = async (oldPassword, newPassword) => {
    const res = await authApi.changePassword({ oldPassword, newPassword });
    setUser(null); // Backend revokes previous sessions on password change
    addToast(
      "Password changed successfully. Please log in again with your new password.",
      "success",
    );
    return res;
  };

  const value = {
    user,
    loading,
    isEmailVerified: !!user?.isEmailVerified,
    login,
    register,
    logout,
    checkAuth,
    resendVerification,
    changePassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
