/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem("rms_access_token") || "");
  const [refreshToken, setRefreshToken] = useState(() => localStorage.getItem("rms_refresh_token") || "");
  const [role, setRole] = useState(() => localStorage.getItem("rms_role") || "");
  const [userName, setUserName] = useState(() => localStorage.getItem("rms_user_name") || "");
  const [userId, setUserId] = useState(() => localStorage.getItem("rms_user_id") || "");

  const login = ({ access_token, refresh_token, role: r, user_id, user_name }, selectedRole) => {
    const finalRole = r || selectedRole;
    localStorage.setItem("rms_access_token", access_token);
    localStorage.setItem("rms_refresh_token", refresh_token);
    localStorage.setItem("rms_role", finalRole);
    localStorage.setItem("rms_user_name", user_name || "");
    localStorage.setItem("rms_user_id", String(user_id || ""));
    setAccessToken(access_token);
    setRefreshToken(refresh_token);
    setRole(finalRole);
    setUserName(user_name || "");
    setUserId(String(user_id || ""));
  };

  const logout = () => {
    ["rms_access_token", "rms_refresh_token", "rms_role", "rms_user_name", "rms_user_id"].forEach(
      (k) => localStorage.removeItem(k)
    );
    setAccessToken("");
    setRefreshToken("");
    setRole("");
    setUserName("");
    setUserId("");
  };

  // Fetch role from server if we have a token but don't know the role
  useEffect(() => {
    if (accessToken && !role) {
      api.getMe().then((data) => {
        if (data?.role) {
          setRole(data.role);
          setUserName(data.name || "");
          setUserId(String(data.id || ""));
          localStorage.setItem("rms_role", data.role);
          localStorage.setItem("rms_user_name", data.name || "");
          localStorage.setItem("rms_user_id", String(data.id || ""));
        }
      }).catch(() => {});
    }
  }, [accessToken, role]);

  const value = useMemo(
    () => ({
      isAuthenticated: Boolean(accessToken),
      accessToken,
      refreshToken,
      role,
      userName,
      userId,
      login,
      logout,
    }),
    [accessToken, refreshToken, role, userName, userId]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
