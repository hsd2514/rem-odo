import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useToast } from "../context/toast-context";
import { AppShell } from "../components/layout/app-shell";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Tabs } from "../components/ui/tabs";
import { Modal } from "../components/ui/modal";
import { Plus, Upload, Send, FileText } from "lucide-react";

export function EmployeePage() {
  const qc = useQueryClient();
  const toast = useToast();
  const fileRef = useRef(null);
  const [tab, setTab] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [form, setForm] = useState({
    amount: "",
    category: "Food",
    description: "",
    expense_date: new Date().toISOString().slice(0, 16),
    paid_by: "Self",
    currency: "USD",
    remarks: "",
  });

  const expensesQuery = useQuery({ queryKey: ["my-expenses"], queryFn: api.myExpenses });

  const createMutation = useMutation({
    mutationFn: api.createExpense,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-expenses"] });
      toast.success("Expense created as draft");
      setShowForm(false);
      resetForm();
    },
    onError: (err) => toast.error(err.message),
  });

  const submitMutation = useMutation({
    mutationFn: (id) => api.submitExpense(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-expenses"] });
      toast.success("Expense submitted for approval");
      setSelectedExpense(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const uploadMutation = useMutation({
    mutationFn: (file) => api.uploadReceipt(file),
    onSuccess: (data) => {
      toast.success("Receipt scanned successfully");
      setForm((p) => ({
        ...p,
        amount: data.amount ? String(data.amount) : p.amount,
        description: data.vendor || p.description,
        category: data.category_guess || p.category,
      }));
      setShowForm(true);
    },
    onError: (err) => toast.error("OCR failed: " + err.message),
  });

  const resetForm = () => {
    setForm({
      amount: "", category: "Food", description: "",
      expense_date: new Date().toISOString().slice(0, 16),
      paid_by: "Self", currency: "USD", remarks: "",
    });
  };

  const expenses = expensesQuery.data || [];
  const filtered = useMemo(() => {
    if (tab === "all") return expenses;
    if (tab === "draft") return expenses.filter((e) => e.status === "draft");
    if (tab === "pending") return expenses.filter((e) => e.status === "pending");
    if (tab === "approved") return expenses.filter((e) => e.status === "approved");
    if (tab === "rejected") return expenses.filter((e) => e.status === "rejected");
    return expenses;
  }, [expenses, tab]);

  const counts = useMemo(() => ({
    all: expenses.length,
    draft: expenses.filter((e) => e.status === "draft").length,
    pending: expenses.filter((e) => e.status === "pending").length,
    approved: expenses.filter((e) => e.status === "approved").length,
    rejected: expenses.filter((e) => e.status === "rejected").length,
  }), [expenses]);

  const stats = useMemo(() => ({
    toSubmit: expenses.filter((e) => e.status === "draft").reduce((s, e) => s + e.amount, 0),
    waiting: expenses.filter((e) => e.status === "pending").reduce((s, e) => s + e.converted_amount, 0),
    approved: expenses.filter((e) => e.status === "approved").reduce((s, e) => s + e.converted_amount, 0),
  }), [expenses]);

  const handleUpload = () => fileRef.current?.click();
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) uploadMutation.mutate(file);
    e.target.value = "";
  };

  const loadDetail = async (expense) => {
    try {
      const detail = await api.getExpenseDetail(expense.id);
      setSelectedExpense(detail);
    } catch {
      setSelectedExpense({ expense, approval_logs: [] });
    }
  };

  return (
    <AppShell>
      <input type="file" ref={fileRef} hidden accept="image/*" onChange={handleFileChange} />

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h2 className="font-display" style={{ fontSize: "1.5rem" }}>My Expenses</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginTop: "0.2rem" }}>
            Track and manage your expense submissions
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Button onClick={handleUpload}>
            <Upload size={14} />
            {uploadMutation.isPending ? "Scanning..." : "Upload Receipt"}
          </Button>
          <Button variant="primary" onClick={() => { setShowForm(!showForm); resetForm(); }}>
            <Plus size={14} />
            New Expense
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
        <div className="stat-card">
          <span className="stat-label">To Submit</span>
          <span className="stat-value">{stats.toSubmit.toFixed(0)}</span>
          <span className="stat-sub">{counts.draft} draft{counts.draft !== 1 ? "s" : ""}</span>
        </div>
        <div className="stat-card" style={{ borderColor: "rgba(251,191,36,0.3)" }}>
          <span className="stat-label">Waiting Approval</span>
          <span className="stat-value">{stats.waiting.toFixed(0)}</span>
          <span className="stat-sub">{counts.pending} pending</span>
        </div>
        <div className="stat-card" style={{ borderColor: "rgba(52,211,153,0.3)" }}>
          <span className="stat-label">Approved</span>
          <span className="stat-value">{stats.approved.toFixed(0)}</span>
          <span className="stat-sub">{counts.approved} expense{counts.approved !== 1 ? "s" : ""}</span>
        </div>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="card" style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
          <h3 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: "1rem" }}>New Expense</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <Input label="Description" placeholder="Restaurant bill, taxi fare..." value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
            <Input label="Expense Date" type="datetime-local" value={form.expense_date} onChange={(e) => setForm((p) => ({ ...p, expense_date: e.target.value }))} />
            <Select label="Category" value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}>
              <option>Food</option><option>Travel</option><option>Lodging</option><option>Miscellaneous</option>
            </Select>
            <Input label="Paid By" placeholder="Self, Company Card..." value={form.paid_by} onChange={(e) => setForm((p) => ({ ...p, paid_by: e.target.value }))} />
            <Select label="Currency" value={form.currency} onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))}>
              <option>USD</option><option>INR</option><option>EUR</option><option>GBP</option><option>AED</option><option>JPY</option><option>CAD</option><option>AUD</option>
            </Select>
            <Input label="Amount" type="number" placeholder="567.00" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} />
            <div style={{ gridColumn: "1 / -1" }}>
              <Textarea label="Remarks" placeholder="Additional notes..." value={form.remarks} onChange={(e) => setForm((p) => ({ ...p, remarks: e.target.value }))} />
            </div>
          </div>
          <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem" }}>
            <Button variant="primary" onClick={() => createMutation.mutate({
              ...form,
              amount: Number(form.amount),
              expense_date: new Date(form.expense_date).toISOString(),
            })}>
              {createMutation.isPending ? "Creating..." : "Save as Draft"}
            </Button>
            <Button onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Tabs + Table */}
      <div style={{ marginBottom: "1rem" }}>
        <Tabs
          items={[
            { key: "all", label: "All", count: counts.all },
            { key: "draft", label: "Draft", count: counts.draft },
            { key: "pending", label: "Waiting Approval", count: counts.pending },
            { key: "approved", label: "Approved", count: counts.approved },
            { key: "rejected", label: "Rejected", count: counts.rejected },
          ]}
          active={tab}
          onChange={setTab}
        />
      </div>

      <div className="card" style={{ overflow: "hidden" }}>
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th>Date</th>
              <th>Category</th>
              <th>Amount</th>
              <th>Company Amount</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="empty-state">No expenses found{tab !== "all" ? ` with status "${tab}"` : ""}.</td></tr>
            ) : (
              filtered.map((item) => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 600 }}>{item.description}</td>
                  <td style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>{new Date(item.expense_date).toLocaleDateString()}</td>
                  <td>{item.category}</td>
                  <td style={{ fontWeight: 600 }}>{item.amount} <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{item.currency}</span></td>
                  <td>{item.converted_amount} <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{item.base_currency}</span></td>
                  <td><Badge status={item.status}>{item.status}</Badge></td>
                  <td>
                    <div style={{ display: "flex", gap: "0.35rem" }}>
                      <Button size="xs" onClick={() => loadDetail(item)}>
                        <FileText size={11} /> View
                      </Button>
                      {item.status === "draft" && (
                        <Button size="xs" variant="primary" onClick={() => submitMutation.mutate(item.id)}>
                          <Send size={11} /> Submit
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

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
                ["Amount", `${selectedExpense.expense.amount} ${selectedExpense.expense.currency}`],
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

            {selectedExpense.expense.remarks && (
              <div style={{ marginBottom: "1.5rem" }}>
                <span className="label">Remarks</span>
                <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", margin: 0 }}>{selectedExpense.expense.remarks}</p>
              </div>
            )}

            {/* Approval Log */}
            <hr className="divider" />
            <span className="label" style={{ marginBottom: "0.75rem" }}>Approval History</span>
            {(selectedExpense.approval_logs || []).length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>No approval activity yet.</p>
            ) : (
              <table style={{ marginTop: "0.5rem" }}>
                <thead>
                  <tr><th>Approver</th><th>Decision</th><th>Time</th></tr>
                </thead>
                <tbody>
                  {selectedExpense.approval_logs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ fontWeight: 600 }}>{log.approver_name}</td>
                      <td><Badge status={log.decision}>{log.decision}</Badge></td>
                      <td style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Submit button for drafts */}
            {selectedExpense.expense.status === "draft" && (
              <div style={{ marginTop: "1.25rem" }}>
                <Button variant="primary" onClick={() => submitMutation.mutate(selectedExpense.expense.id)}>
                  <Send size={14} />
                  Submit for Approval
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </AppShell>
  );
}
