const STATUS_MAP = {
  draft: "badge-draft",
  pending: "badge-pending",
  approved: "badge-approved",
  rejected: "badge-rejected",
};

export function Badge({ status, children }) {
  const cls = STATUS_MAP[status] || "badge-draft";
  return <span className={`badge ${cls}`}>{children || status}</span>;
}
