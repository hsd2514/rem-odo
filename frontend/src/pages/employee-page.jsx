import { useCallback, useMemo, useRef, useState } from "react";
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
import { TimelinePanel } from "../components/ui/timeline-panel";
import { Plus, Upload, Send, FileText, ScanLine, X, ImageIcon } from "lucide-react";

const CATEGORIES = ["Food", "Travel", "Lodging", "Miscellaneous", "Office", "Medical", "Entertainment"];
const CURRENCIES = ["USD", "INR", "EUR", "GBP", "AED", "JPY", "CAD", "AUD", "SGD", "CHF"];

function parseOCRDate(dateStr) {
  if (!dateStr) return null;
  const cleaned = dateStr.trim();
  // Try ISO or datetime-local compatible
  const iso = new Date(cleaned);
  if (!isNaN(iso.getTime())) return iso.toISOString().slice(0, 16);

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmy = cleaned.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const year = y.length === 2 ? `20${y}` : y;
    const d2 = new Date(`${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`);
    if (!isNaN(d2.getTime())) return d2.toISOString().slice(0, 16);
  }
  return null;
}

function ReceiptUploadZone({ onFile, uploading, preview, onClear }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file && file.type.startsWith("image/")) onFile(file);
    },
    [onFile]
  );

  const handleDragOver = (e) => { e.preventDefault(); setDragging(true); };
  const handleDragLeave = () => setDragging(false);

  if (preview) {
    return (
      <div style={{
        position: "relative",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-sm)",
        overflow: "hidden",
        background: "var(--surface-raised)",
        height: "160px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <img
          src={preview}
          alt="Receipt preview"
          style={{ maxHeight: "100%", maxWidth: "100%", objectFit: "contain" }}
        />
        <button
          onClick={onClear}
          style={{
            position: "absolute",
            top: "0.4rem",
            right: "0.4rem",
            background: "rgba(0,0,0,0.55)",
            border: "none",
            borderRadius: "50%",
            width: "1.6rem",
            height: "1.6rem",
            cursor: "pointer",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          title="Remove receipt"
        >
          <X size={12} />
        </button>
        <div style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          background: "linear-gradient(transparent, rgba(0,0,0,0.5))",
          padding: "0.5rem 0.65rem",
          fontSize: "0.72rem",
          color: "#fff",
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          gap: "0.3rem",
        }}>
          <ScanLine size={11} /> Receipt scanned — fields autofilled
        </div>
      </div>
    );
  }

  return (
    <div
      className="upload-zone"
      style={{
        padding: "1.5rem 1rem",
        cursor: uploading ? "wait" : "pointer",
        borderColor: dragging ? "var(--accent)" : undefined,
        background: dragging ? "var(--accent-soft)" : undefined,
        color: dragging ? "var(--accent)" : undefined,
        transition: "all 0.2s",
        borderRadius: "var(--radius-sm)",
      }}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={() => !uploading && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
      {uploading ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
          <div style={{
            width: "2rem", height: "2rem",
            border: "2px solid var(--border)",
            borderTopColor: "var(--accent)",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }} />
          <span style={{ fontSize: "0.8rem" }}>Scanning receipt…</span>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.4rem" }}>
          <Upload size={22} style={{ opacity: 0.5 }} />
          <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>
            {dragging ? "Drop receipt here" : "Upload Receipt"}
          </span>
          <span style={{ fontSize: "0.74rem", opacity: 0.7 }}>
            Drag & drop or click · JPG, PNG, WEBP
          </span>
        </div>
      )}
    </div>
  );
}

function ImagePreviewModal({ url, onClose }) {
  if (!url) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(6px)",
        zIndex: 300,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "zoom-out",
      }}
    >
      <img
        src={url}
        alt="Receipt"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "90vw",
          maxHeight: "90vh",
          objectFit: "contain",
          borderRadius: "8px",
          boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
          cursor: "default",
        }}
      />
      <button
        onClick={onClose}
        style={{
          position: "fixed",
          top: "1rem",
          right: "1rem",
          background: "rgba(255,255,255,0.15)",
          border: "1px solid rgba(255,255,255,0.25)",
          borderRadius: "50%",
          width: "2.25rem",
          height: "2.25rem",
          cursor: "pointer",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

function resolveReceiptUrl(url) {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  return `${API_BASE}${url}`;
}

export function EmployeePage() {
  const qc = useQueryClient();
  const toast = useToast();

  const [tab, setTab] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [lightboxUrl, setLightboxUrl] = useState(null);

  // Receipt state for the new expense form
  const [pendingReceiptId, setPendingReceiptId] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState(null); // local object URL

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
    onSuccess: async (expense) => {
      // Link receipt if we have one waiting
      if (pendingReceiptId) {
        try {
          await api.attachReceipt(expense.id, pendingReceiptId);
        } catch {
          // non-fatal — receipt uploaded but linking failed
          toast.info?.("Expense saved; receipt link failed — try again.");
        }
      }
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
    onSuccess: (data, file) => {
      toast.success("Receipt scanned — fields autofilled");
      // Store receipt_id to attach on save
      if (data.receipt_id) setPendingReceiptId(data.receipt_id);

      // Parse OCR date
      const parsedDate = parseOCRDate(data.expense_date);

      setForm((p) => ({
        ...p,
        amount: data.amount != null ? String(data.amount) : p.amount,
        description: data.vendor || p.description,
        category: data.category_guess || p.category,
        expense_date: parsedDate || p.expense_date,
      }));

      // Local preview
      setReceiptPreview(URL.createObjectURL(file));
      setShowForm(true);
    },
    onError: (err) => toast.error("OCR failed: " + err.message),
  });

  const resetForm = () => {
    setForm({
      amount: "",
      category: "Food",
      description: "",
      expense_date: new Date().toISOString().slice(0, 16),
      paid_by: "Self",
      currency: "USD",
      remarks: "",
    });
    setPendingReceiptId(null);
    if (receiptPreview) URL.revokeObjectURL(receiptPreview);
    setReceiptPreview(null);
  };

  const handleReceiptFile = (file) => {
    uploadMutation.mutate(file);
  };

  const clearReceipt = () => {
    setPendingReceiptId(null);
    if (receiptPreview) URL.revokeObjectURL(receiptPreview);
    setReceiptPreview(null);
  };

  const expenses = expensesQuery.data || [];
  const filtered = useMemo(() => {
    if (tab === "all") return expenses;
    return expenses.filter((e) => e.status === tab);
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

  return (
    <AppShell>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .ocr-chip {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          background: var(--accent-soft);
          color: var(--accent);
          border: 1px solid rgba(30,64,175,0.15);
          border-radius: 100px;
          font-size: 0.7rem;
          font-weight: 700;
          padding: 0.15rem 0.55rem;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }
        .receipt-thumb {
          width: 44px;
          height: 44px;
          object-fit: cover;
          border-radius: 6px;
          border: 1px solid var(--border);
          cursor: zoom-in;
          transition: transform 0.15s;
          flex-shrink: 0;
        }
        .receipt-thumb:hover { transform: scale(1.08); }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h2 className="font-display" style={{ fontSize: "1.5rem" }}>My Expenses</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginTop: "0.2rem" }}>
            Track and manage your expense submissions
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Button
            variant="primary"
            onClick={() => { setShowForm(!showForm); resetForm(); }}
          >
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
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <h3 style={{ fontSize: "0.95rem", fontWeight: 700, margin: 0 }}>New Expense</h3>
              {pendingReceiptId && (
                <span className="ocr-chip">
                  <ScanLine size={10} /> Receipt Attached
                </span>
              )}
            </div>
            <Button size="xs" onClick={() => { setShowForm(false); resetForm(); }}>
              <X size={11} /> Close
            </Button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: "1rem", alignItems: "start" }}>
            {/* Receipt Upload Zone */}
            <div>
              <span className="label" style={{ marginBottom: "0.4rem" }}>
                <Upload size={11} style={{ display: "inline", marginRight: "0.25rem", verticalAlign: "middle" }} />
                Upload Receipt
              </span>
              <ReceiptUploadZone
                onFile={handleReceiptFile}
                uploading={uploadMutation.isPending}
                preview={receiptPreview}
                onClear={clearReceipt}
              />
              {!receiptPreview && !uploadMutation.isPending && (
                <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.4rem", textAlign: "center", lineHeight: 1.4 }}>
                  OCR will autofill amount, date & category
                </p>
              )}
            </div>

            {/* Form Fields Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <Input
                label="Description"
                placeholder="Restaurant bill, taxi fare..."
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              />
              <Input
                label="Expense Date"
                type="datetime-local"
                value={form.expense_date}
                onChange={(e) => setForm((p) => ({ ...p, expense_date: e.target.value }))}
              />
              <Select
                label="Category"
                value={form.category}
                onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
              >
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </Select>
              <Input
                label="Paid By"
                placeholder="Self, Company Card..."
                value={form.paid_by}
                onChange={(e) => setForm((p) => ({ ...p, paid_by: e.target.value }))}
              />
              <Select
                label="Currency"
                value={form.currency}
                onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))}
              >
                {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
              </Select>
              <Input
                label="Amount"
                type="number"
                placeholder="567.00"
                value={form.amount}
                onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
              />
              <div style={{ gridColumn: "1 / -1" }}>
                <Textarea
                  label="Remarks"
                  placeholder="Additional notes..."
                  value={form.remarks}
                  onChange={(e) => setForm((p) => ({ ...p, remarks: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <Button
              variant="primary"
              onClick={() =>
                createMutation.mutate({
                  ...form,
                  amount: Number(form.amount),
                  expense_date: new Date(form.expense_date).toISOString(),
                })
              }
              disabled={createMutation.isPending || !form.amount || !form.description}
            >
              {createMutation.isPending ? "Saving…" : "Save as Draft"}
            </Button>
            <Button onClick={() => { setShowForm(false); resetForm(); }}>Cancel</Button>
            {pendingReceiptId && (
              <span style={{ fontSize: "0.75rem", color: "var(--success)", marginLeft: "0.5rem" }}>
                ✓ Receipt will be linked on save
              </span>
            )}
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
              <tr>
                <td colSpan={7} className="empty-state">
                  No expenses found{tab !== "all" ? ` with status "${tab}"` : ""}.
                </td>
              </tr>
            ) : (
              filtered.map((item) => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 600 }}>{item.description}</td>
                  <td style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>
                    {new Date(item.expense_date).toLocaleDateString()}
                  </td>
                  <td>{item.category}</td>
                  <td style={{ fontWeight: 600 }}>
                    {item.amount}{" "}
                    <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{item.currency}</span>
                  </td>
                  <td>
                    {item.converted_amount}{" "}
                    <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{item.base_currency}</span>
                  </td>
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
                <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", margin: 0 }}>
                  {selectedExpense.expense.remarks}
                </p>
              </div>
            )}

            {/* Receipt section */}
            {selectedExpense.receipt_url && (
              <>
                <hr className="divider" />
                <div style={{ marginBottom: "1.5rem" }}>
                  <span className="label" style={{ marginBottom: "0.5rem" }}>
                    <ImageIcon size={11} style={{ display: "inline", marginRight: "0.25rem", verticalAlign: "middle" }} />
                    Receipt
                  </span>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer" }}
                    onClick={() => setLightboxUrl(resolveReceiptUrl(selectedExpense.receipt_url))}
                  >
                    <img
                      src={resolveReceiptUrl(selectedExpense.receipt_url)}
                      alt="Receipt"
                      className="receipt-thumb"
                    />
                    <div>
                      <p style={{ fontSize: "0.82rem", fontWeight: 600, margin: 0 }}>Receipt attached</p>
                      <p style={{ fontSize: "0.74rem", color: "var(--text-muted)", margin: 0 }}>
                        Click to view full image
                      </p>
                    </div>
                  </div>
                </div>
              </>
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

            <TimelinePanel timeline={selectedExpense.timeline} />

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

      {/* Lightbox */}
      <ImagePreviewModal url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
    </AppShell>
  );
}
