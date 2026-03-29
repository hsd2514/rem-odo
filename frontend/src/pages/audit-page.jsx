import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, Search } from "lucide-react";
import { api } from "../lib/api";
import { AppShell } from "../components/layout/app-shell";
import { Badge } from "../components/ui/badge";

const ACTION_LABELS = {
  expense_created: "Created",
  expense_submitted: "Submitted",
  approval_decision: "Decision",
  override: "Override",
};

function matchesDateRange(ts, range) {
  if (range === "all") return true;
  const now = Date.now();
  const target = new Date(ts).getTime();
  if (Number.isNaN(target)) return false;
  if (range === "last7") return target >= now - 7 * 24 * 60 * 60 * 1000;
  if (range === "last30") return target >= now - 30 * 24 * 60 * 60 * 1000;
  return true;
}

export function AuditPage() {
  const [query, setQuery] = useState("");
  const [actionType, setActionType] = useState("all");
  const [actorRole, setActorRole] = useState("all");
  const [dateRange, setDateRange] = useState("all");

  const auditQ = useQuery({
    queryKey: ["audit-stream"],
    queryFn: () => api.auditStream(300),
  });

  const events = auditQ.data || [];

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return events.filter((item) => {
      if (actionType !== "all" && item.event_type !== actionType) return false;
      if (actorRole !== "all" && item.actor_role !== actorRole) return false;
      if (!matchesDateRange(item.timestamp, dateRange)) return false;
      if (!term) return true;
      const haystack = [
        item.actor_name,
        item.actor_role,
        item.expense_description,
        item.message,
        item.decision,
        String(item.expense_id),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [events, query, actionType, actorRole, dateRange]);

  return (
    <AppShell>
      <div style={{ marginBottom: "1.2rem" }}>
        <h2 className="font-display" style={{ fontSize: "1.5rem" }}>Audit Stream</h2>
        <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginTop: "0.2rem" }}>
          Normalized activity feed with actor, action, target, and timestamp metadata.
        </p>
      </div>

      <div className="card" style={{ padding: "1rem", marginBottom: "1rem" }}>
        <div className="audit-filter-grid" style={{ display: "grid", gap: "0.75rem" }}>
          <label className="input-wrap">
            <span className="label">Search</span>
            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
              <Search size={14} style={{ color: "var(--text-muted)" }} />
              <input
                className="input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Actor, target, message, decision..."
              />
            </div>
          </label>
          <label className="input-wrap">
            <span className="label">Action</span>
            <select className="select" value={actionType} onChange={(e) => setActionType(e.target.value)}>
              <option value="all">All actions</option>
              <option value="expense_created">Expense Created</option>
              <option value="expense_submitted">Expense Submitted</option>
              <option value="approval_decision">Approval Decision</option>
              <option value="override">Override</option>
            </select>
          </label>
          <label className="input-wrap">
            <span className="label">Actor Role</span>
            <select className="select" value={actorRole} onChange={(e) => setActorRole(e.target.value)}>
              <option value="all">All roles</option>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="employee">Employee</option>
            </select>
          </label>
          <label className="input-wrap">
            <span className="label">Range</span>
            <select className="select" value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
              <option value="all">All time</option>
              <option value="last7">Last 7 days</option>
              <option value="last30">Last 30 days</option>
            </select>
          </label>
        </div>
      </div>

      <div className="card" style={{ overflow: "hidden" }}>
        {auditQ.isLoading ? (
          <div className="empty-state">Loading activity stream…</div>
        ) : auditQ.isError ? (
          <div className="empty-state" style={{ color: "var(--danger)" }}>
            Failed to load audit events. {auditQ.error?.message || ""}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">No activity matches the selected filters.</div>
        ) : (
          <div className="audit-timeline">
            {filtered.map((event) => (
              <div className="audit-row" key={event.id}>
                <div className="audit-icon-wrap">
                  <Activity size={14} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", gap: "0.45rem", alignItems: "center", flexWrap: "wrap" }}>
                    <Badge status={event.event_type === "override" ? "pending" : "approved"}>
                      {ACTION_LABELS[event.event_type] || event.event_type}
                    </Badge>
                    <span style={{ fontSize: "0.76rem", color: "var(--text-muted)" }}>
                      {new Date(event.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p style={{ margin: "0.35rem 0 0", fontWeight: 700, color: "var(--text-primary)", fontSize: "0.86rem" }}>
                    {event.actor_name || "Unknown Actor"}{" "}
                    <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>
                      ({event.actor_role || "unknown"})
                    </span>
                    {" · "}
                    Expense #{event.expense_id}
                  </p>
                  <p style={{ margin: "0.15rem 0 0", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                    Target: {event.expense_description || "Untitled expense"}
                  </p>
                  <p style={{ margin: "0.15rem 0 0", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                    Action detail: {event.message || event.decision || "No additional details"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
