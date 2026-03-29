import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/auth-context";
import { LogOut, Shield, Users, Receipt, CheckCircle, BarChart3 } from "lucide-react";

const NAV_BY_ROLE = {
  admin: [
    { to: "/admin", label: "User Management", icon: Users },
    { to: "/admin/rules", label: "Approval Rules", icon: Shield },
    { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  ],
  employee: [
    { to: "/employee", label: "My Expenses", icon: Receipt },
  ],
  manager: [
    { to: "/manager", label: "Approvals", icon: CheckCircle },
  ],
};

export function AppShell({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, role, userName } = useAuth();

  const navItems = NAV_BY_ROLE[role] || [];

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* Sidebar */}
      <aside
        style={{
          width: "240px",
          background: "#ffffff",
          borderRight: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
        }}
      >
        {/* Logo */}
        <div style={{ padding: "1.5rem 1.25rem", borderBottom: "1px solid var(--border)" }}>
          <h1
            className="font-display"
            style={{ fontSize: "1.15rem", color: "var(--accent)", lineHeight: 1.3, margin: 0 }}
          >
            Reimburse
          </h1>
          <p style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "0.15rem", letterSpacing: "0.03em" }}>
            Expense Management
          </p>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "0.75rem 0.5rem", display: "flex", flexDirection: "column", gap: "2px" }}>
          {navItems.map((item) => {
            const active = location.pathname === item.to || location.pathname.startsWith(item.to + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.65rem",
                  padding: "0.6rem 0.85rem",
                  borderRadius: "var(--radius-sm)",
                  fontWeight: active ? 700 : 500,
                  fontSize: "0.835rem",
                  color: active ? "var(--accent)" : "var(--text-secondary)",
                  background: active ? "var(--accent-soft)" : "transparent",
                  textDecoration: "none",
                  transition: "all 0.15s",
                }}
              >
                <Icon size={16} strokeWidth={active ? 2.5 : 2} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div
          style={{
            borderTop: "1px solid var(--border)",
            padding: "1rem 1.25rem",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
          }}
        >
          <div
            style={{
              width: "2rem",
              height: "2rem",
              borderRadius: "50%",
              background: "var(--accent-soft)",
              display: "grid",
              placeItems: "center",
              fontWeight: 700,
              fontSize: "0.75rem",
              color: "var(--accent)",
              flexShrink: 0,
            }}
          >
            {(userName || "U")[0].toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: "0.8rem", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {userName || "User"}
            </div>
            <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", textTransform: "capitalize" }}>
              {role}
            </div>
          </div>
          <button
            className="btn btn-ghost btn-xs"
            onClick={() => { logout(); navigate("/auth"); }}
            title="Logout"
          >
            <LogOut size={14} />
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, padding: "1.5rem 2rem", overflow: "auto", background: "var(--bg-deep)" }}>
        {children}
      </main>
    </div>
  );
}
