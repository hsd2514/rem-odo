import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "../components/layout/app-shell";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { useAuth } from "../context/auth-context";
import { useToast } from "../context/toast-context";
import { api } from "../lib/api";
import {
  User, Building2, Globe, Shield, Bell, Palette,
} from "lucide-react";

export function SettingsPage() {
  const { role, userName } = useAuth();
  const toast = useToast();
  const meQuery = useQuery({ queryKey: ["me"], queryFn: api.getMe });
  const me = meQuery.data;

  // Notification preferences (local only)
  const [notifs, setNotifs] = useState({
    emailApprovals: true,
    emailSubmissions: true,
    emailRejections: true,
    browserNotifs: false,
  });

  const toggleNotif = (key) => setNotifs((p) => ({ ...p, [key]: !p[key] }));

  return (
    <AppShell>
      {/* Header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h2 className="font-display" style={{ fontSize: "1.5rem" }}>Settings</h2>
        <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginTop: "0.2rem" }}>
          Manage your account and preferences
        </p>
      </div>

      {/* Profile Section */}
      <div className="dashboard-charts-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="dashboard-chart-card">
          <h4 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <User size={16} /> Profile Information
          </h4>
          {meQuery.isLoading ? (
            <p style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>Loading...</p>
          ) : (
            <div style={{ display: "grid", gap: "0.85rem" }}>
              {[
                ["Full Name", me?.name || userName || "—"],
                ["Email", me?.email || "—"],
                ["Role", (me?.role || role || "—").charAt(0).toUpperCase() + (me?.role || role || "").slice(1)],
                ["User ID", me?.id ? `#${me.id}` : "—"],
              ].map(([label, value]) => (
                <div key={label}>
                  <div style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-muted)", marginBottom: "0.2rem" }}>
                    {label}
                  </div>
                  <div style={{ fontSize: "0.88rem", fontWeight: 500, color: "var(--text-primary)" }}>
                    {value}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="dashboard-chart-card">
          <h4 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Building2 size={16} /> Company Details
          </h4>
          {meQuery.isLoading ? (
            <p style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>Loading...</p>
          ) : (
            <div style={{ display: "grid", gap: "0.85rem" }}>
              {[
                ["Company", me?.company_name || "—"],
                ["Country", me?.country || "—"],
                ["Base Currency", me?.default_currency || "—"],
                ["Company ID", me?.company_id ? `#${me.company_id}` : "—"],
              ].map(([label, value]) => (
                <div key={label}>
                  <div style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-muted)", marginBottom: "0.2rem" }}>
                    {label}
                  </div>
                  <div style={{ fontSize: "0.88rem", fontWeight: 500, color: "var(--text-primary)" }}>
                    {value}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Notifications Section */}
      <div style={{ marginTop: "1.5rem" }}>
        <div className="dashboard-chart-card">
          <h4 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Bell size={16} /> Notification Preferences
          </h4>
          <div style={{ display: "grid", gap: "0.5rem" }}>
            {[
              { key: "emailApprovals", label: "Email me when my expense is approved" },
              { key: "emailSubmissions", label: "Email me when new expenses are submitted (managers)" },
              { key: "emailRejections", label: "Email me when my expense is rejected" },
              { key: "browserNotifs", label: "Enable browser push notifications" },
            ].map((item) => (
              <label
                key={item.key}
                style={{
                  display: "flex", alignItems: "center", gap: "0.75rem",
                  padding: "0.6rem 0.75rem", borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)", cursor: "pointer",
                  background: notifs[item.key] ? "var(--accent-soft)" : "var(--surface)",
                  transition: "all 0.15s",
                }}
              >
                <input
                  type="checkbox"
                  checked={notifs[item.key]}
                  onChange={() => toggleNotif(item.key)}
                  style={{ accentColor: "var(--accent)", width: 16, height: 16 }}
                />
                <span style={{ fontSize: "0.82rem", color: "var(--text-primary)" }}>{item.label}</span>
              </label>
            ))}
          </div>
          <div style={{ marginTop: "1rem" }}>
            <Button variant="primary" onClick={() => toast.success("Preferences saved")}>
              Save Preferences
            </Button>
          </div>
        </div>
      </div>

      {/* App Info */}
      <div style={{ marginTop: "1.5rem" }}>
        <div className="dashboard-chart-card">
          <h4 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Shield size={16} /> About
          </h4>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
            {[
              ["Application", "Reimburse"],
              ["Version", "1.0.0"],
              ["API Endpoint", "localhost:8000"],
              ["Session", "Active"],
            ].map(([label, value]) => (
              <div key={label}>
                <div style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-muted)", marginBottom: "0.2rem" }}>
                  {label}
                </div>
                <div style={{ fontSize: "0.82rem", color: "var(--text-primary)" }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
