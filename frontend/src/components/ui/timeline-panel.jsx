import { Badge } from "./badge";

function eventTone(eventType, decision) {
  if (eventType === "override" || (decision || "").startsWith("override_")) return "rejected";
  if (decision === "approved") return "approved";
  if (decision === "rejected") return "rejected";
  if (eventType === "approval_step") return "pending";
  return "draft";
}

function eventLabel(item) {
  if (item.event_type === "expense_created") return "Expense Created";
  if (item.event_type === "expense_submitted") return "Submitted";
  if (item.event_type === "approval_step") return `Step ${item.step_order || "?"} Assigned`;
  if (item.event_type === "override") return "Admin Override";
  return "Approval Decision";
}

export function TimelinePanel({ timeline }) {
  const events = timeline?.events || [];
  return (
    <div style={{ marginTop: "1rem" }}>
      <span className="label" style={{ marginBottom: "0.75rem" }}>Approval Timeline</span>
      {events.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>No timeline events available.</p>
      ) : (
        <div style={{ position: "relative", paddingLeft: "1.1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <div
            style={{
              position: "absolute",
              left: "0.4rem",
              top: "0.2rem",
              bottom: "0.2rem",
              width: "2px",
              background: "linear-gradient(180deg, var(--accent), rgba(107,114,128,0.15))",
            }}
          />
          {events.map((item) => (
            <div
              key={item.id}
              style={{
                position: "relative",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                background: "var(--bg-base)",
                padding: "0.6rem 0.75rem",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: "-0.92rem",
                  top: "0.9rem",
                  width: "10px",
                  height: "10px",
                  borderRadius: "999px",
                  background: "var(--accent)",
                  boxShadow: "0 0 0 3px rgba(250,250,250,0.9)",
                }}
              />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", flexWrap: "wrap" }}>
                  <strong style={{ fontSize: "0.82rem" }}>{eventLabel(item)}</strong>
                  <Badge status={eventTone(item.event_type, item.decision)}>
                    {item.decision || item.event_type}
                  </Badge>
                </div>
                <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                  {new Date(item.timestamp).toLocaleString()}
                </span>
              </div>
              <div style={{ marginTop: "0.35rem", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                  {item.actor_name || "System"}
                </span>
                {item.actor_role ? ` (${item.actor_role})` : ""}
                {item.comment ? `: ${item.comment}` : item.message ? `: ${item.message}` : ""}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
