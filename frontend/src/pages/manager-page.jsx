import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "../context/toast-context";
import { useAuth } from "../context/auth-context";
import { AppShell } from "../components/layout/app-shell";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Modal } from "../components/ui/modal";
import { Textarea } from "../components/ui/textarea";
import { TimelinePanel } from "../components/ui/timeline-panel";
import { api } from "../lib/api";
import { CheckCircle, XCircle, Eye } from "lucide-react";

export function ManagerPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { role } = useAuth();
  const [commentModal, setCommentModal] = useState(null); // { id, action }
  const [comment, setComment] = useState("");
  const [selectedExpense, setSelectedExpense] = useState(null);

  const teamQuery = useQuery({ queryKey: ["team-expenses"], queryFn: api.teamExpenses });

  const approveMutation = useMutation({
    mutationFn: ({ id, comment }) => api.approve(id, comment),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team-expenses"] });
      toast.success("Expense approved");
      setCommentModal(null);
      setComment("");
    },
    onError: (err) => toast.error(err.message),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, comment }) => api.reject(id, comment),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team-expenses"] });
      toast.success("Expense rejected");
      setCommentModal(null);
      setComment("");
    },
    onError: (err) => toast.error(err.message),
  });

  const overrideApproveMutation = useMutation({
    mutationFn: ({ id, comment }) => api.overrideApprove(id, comment),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team-expenses"] });
      toast.success("Admin override approval saved");
      setCommentModal(null);
      setComment("");
    },
    onError: (err) => toast.error(err.message),
  });

  const overrideRejectMutation = useMutation({
    mutationFn: ({ id, comment }) => api.overrideReject(id, comment),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team-expenses"] });
      toast.success("Admin override rejection saved");
      setCommentModal(null);
      setComment("");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleAction = () => {
    if (!commentModal) return;
    if (commentModal.action === "approve") {
      approveMutation.mutate({ id: commentModal.id, comment });
    } else if (commentModal.action === "override-approve") {
      overrideApproveMutation.mutate({ id: commentModal.id, comment });
    } else if (commentModal.action === "override-reject") {
      overrideRejectMutation.mutate({ id: commentModal.id, comment });
    } else {
      rejectMutation.mutate({ id: commentModal.id, comment });
    }
  };

  const loadDetail = async (expense) => {
    try {
      const [detail, timeline] = await Promise.all([
        api.getExpenseDetail(expense.id),
        api.getExpenseTimeline(expense.id),
      ]);
      setSelectedExpense({ ...detail, timeline });
    } catch {
      setSelectedExpense({ expense, approval_logs: [] });
    }
  };

  const expenses = teamQuery.data || [];
  const pending = expenses.filter((e) => e.status === "pending");
  const resolved = expenses.filter((e) => e.status !== "pending" && e.status !== "draft");

  return (
    <AppShell>
      <div style={{ marginBottom: "1.5rem" }}>
        <h2 className="font-display" style={{ fontSize: "1.5rem" }}>Approvals to Review</h2>
        <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginTop: "0.2rem" }}>
          {pending.length} pending approval{pending.length !== 1 ? "s" : ""} · {resolved.length} resolved
        </p>
      </div>

      {/* Pending Approvals */}
      <div className="card" style={{ overflow: "hidden", marginBottom: "1.5rem" }}>
        <div style={{ padding: "0.85rem 1rem", borderBottom: "1px solid var(--border)", background: "var(--surface-raised)" }}>
          <span style={{ fontWeight: 700, fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--warning)" }}>
            Pending Review
          </span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Subject</th>
              <th>Request Owner</th>
              <th>Category</th>
              <th>Status</th>
              <th>Amount (Company Currency)</th>
              <th style={{ width: "200px" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pending.length === 0 ? (
              <tr><td colSpan={6} className="empty-state">No pending approvals. All caught up! 🎉</td></tr>
            ) : (
              pending.map((item) => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 600 }}>{item.description}</td>
                  <td style={{ color: "var(--text-secondary)" }}>{item.user_name || `User #${item.user_id}`}</td>
                  <td>{item.category}</td>
                  <td><Badge status={item.status}>{item.status}</Badge></td>
                  <td>
                    <span style={{ fontSize: "0.72rem", color: "var(--accent)", textDecoration: "line-through", marginRight: "0.5rem" }}>
                      {item.amount} {item.currency}
                    </span>
                    <span style={{ fontWeight: 700 }}>
                      {item.converted_amount} {item.base_currency}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "0.35rem" }}>
                      <Button size="xs" onClick={() => loadDetail(item)}>
                        <Eye size={11} />
                      </Button>
                      <Button size="xs" variant="success" onClick={() => setCommentModal({ id: item.id, action: "approve" })}>
                        <CheckCircle size={11} /> Approve
                      </Button>
                      <Button size="xs" variant="danger" onClick={() => setCommentModal({ id: item.id, action: "reject" })}>
                        <XCircle size={11} /> Reject
                      </Button>
                      {role === "admin" && (
                        <>
                          <Button size="xs" onClick={() => setCommentModal({ id: item.id, action: "override-approve" })}>
                            Override +Approve
                          </Button>
                          <Button size="xs" onClick={() => setCommentModal({ id: item.id, action: "override-reject" })}>
                            Override +Reject
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Resolved */}
      {resolved.length > 0 && (
        <div className="card" style={{ overflow: "hidden" }}>
          <div style={{ padding: "0.85rem 1rem", borderBottom: "1px solid var(--border)", background: "var(--surface-raised)" }}>
            <span style={{ fontWeight: 700, fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)" }}>
              Resolved
            </span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Subject</th>
                <th>Request Owner</th>
                <th>Category</th>
                <th>Status</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {resolved.map((item) => (
                <tr key={item.id} style={{ opacity: 0.7 }}>
                  <td>{item.description}</td>
                  <td style={{ color: "var(--text-secondary)" }}>{item.user_name || `User #${item.user_id}`}</td>
                  <td>{item.category}</td>
                  <td><Badge status={item.status}>{item.status}</Badge></td>
                  <td>{item.converted_amount} {item.base_currency}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Comment / Decision Modal */}
      <Modal
        open={!!commentModal}
        onClose={() => { setCommentModal(null); setComment(""); }}
        title={
          commentModal?.action === "approve"
            ? "Approve Expense"
            : commentModal?.action === "reject"
              ? "Reject Expense"
              : commentModal?.action === "override-approve"
                ? "Admin Override Approve"
                : "Admin Override Reject"
        }
      >
        <Textarea
          label="Comment (optional)"
          placeholder="Add a note about your decision..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
        <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem" }}>
          <Button
            variant={commentModal?.action === "approve" || commentModal?.action === "override-approve" ? "success" : "danger"}
            onClick={handleAction}
          >
            {commentModal?.action === "approve" || commentModal?.action === "override-approve" ? (
              <><CheckCircle size={14} /> Confirm Approval</>
            ) : (
              <><XCircle size={14} /> Confirm Rejection</>
            )}
          </Button>
          <Button onClick={() => { setCommentModal(null); setComment(""); }}>Cancel</Button>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal
        open={!!selectedExpense}
        onClose={() => setSelectedExpense(null)}
        title={`Expense: ${selectedExpense?.expense?.description || ""}`}
      >
        {selectedExpense && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1.5rem" }}>
              {[
                ["Category", selectedExpense.expense.category],
                ["Paid By", selectedExpense.expense.paid_by],
                ["Original", `${selectedExpense.expense.amount} ${selectedExpense.expense.currency}`],
                ["Converted", `${selectedExpense.expense.converted_amount} ${selectedExpense.expense.base_currency}`],
                ["Date", new Date(selectedExpense.expense.expense_date).toLocaleDateString()],
                ["Status", selectedExpense.expense.status],
              ].map(([label, value]) => (
                <div key={label}>
                  <span className="label">{label}</span>
                  <p style={{ fontSize: "0.875rem", color: "var(--text-primary)", margin: 0 }}>
                    {label === "Status" ? <Badge status={value}>{value}</Badge> : value}
                  </p>
                </div>
              ))}
            </div>

            <hr className="divider" />
            <span className="label" style={{ marginBottom: "0.75rem" }}>Approval History</span>
            {(selectedExpense.approval_logs || []).length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>No decisions yet.</p>
            ) : (
              <table style={{ marginTop: "0.5rem" }}>
                <thead>
                  <tr><th>Approver</th><th>Decision</th><th>Comment</th><th>Time</th></tr>
                </thead>
                <tbody>
                  {selectedExpense.approval_logs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ fontWeight: 600 }}>{log.approver_name}</td>
                      <td><Badge status={log.decision}>{log.decision}</Badge></td>
                      <td style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>{log.comment || "—"}</td>
                      <td style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <TimelinePanel timeline={selectedExpense.timeline} />
          </div>
        )}
      </Modal>
    </AppShell>
  );
}
