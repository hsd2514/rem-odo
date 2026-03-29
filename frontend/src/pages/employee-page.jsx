import { Fragment, useEffect, useMemo, useRef, useState } from "react";
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
import { AlertTriangle, Eye, Plus, Upload, Send, FileText, X } from "lucide-react";

const POLICY_CONFIG = {
  defaultSoftLimit: 15000,
  categorySoftLimits: {
    Food: 8000,
    Travel: 25000,
    Lodging: 30000,
    Miscellaneous: 10000,
  },
  receiptRequiredAbove: 5000,
  remarksRecommendedAbove: 12000,
  maxAgeDays: 30,
};

function buildPolicyWarnings(expense, detail = null) {
  if (!expense) return [];

  const warnings = [];
  const baseAmount = Number(expense.converted_amount || 0);
  const baseCurrency = expense.base_currency || "base currency";
  const category = expense.category || "Miscellaneous";

  const categoryLimit =
    POLICY_CONFIG.categorySoftLimits[category] ?? POLICY_CONFIG.defaultSoftLimit;

  if (baseAmount > categoryLimit) {
    warnings.push(
      `Amount is above suggested ${category} limit (${categoryLimit} ${baseCurrency}).`
    );
  }

  if (baseAmount >= POLICY_CONFIG.receiptRequiredAbove && !detail?.receipt_url) {
    warnings.push(
      `Receipt is missing for an expense above ${POLICY_CONFIG.receiptRequiredAbove} ${baseCurrency}.`
    );
  }

  if (baseAmount >= POLICY_CONFIG.remarksRecommendedAbove && !String(expense.remarks || "").trim()) {
    warnings.push("Remarks are recommended for high-value submissions.");
  }

  const expenseDate = new Date(expense.expense_date);
  if (!Number.isNaN(expenseDate.getTime())) {
    const daysOld = Math.floor((Date.now() - expenseDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysOld > POLICY_CONFIG.maxAgeDays) {
      warnings.push(`Expense date is older than ${POLICY_CONFIG.maxAgeDays} days.`);
    }
  }

  return warnings;
}

function getExpenseLifecycle(status) {
  const normalized = String(status || "draft").toLowerCase();
  const isRejected = normalized === "rejected";
  const finalLabel = isRejected ? "Rejected" : "Approved";

  let currentIndex = 0;
  if (normalized === "pending") currentIndex = 1;
  if (normalized === "approved" || normalized === "rejected") currentIndex = 2;

  const labels = ["Draft", "Pending", finalLabel];
  const steps = labels.map((label, idx) => {
    if (idx < currentIndex) return { label, state: "complete" };
    if (idx === currentIndex) {
      if (normalized === "rejected" && idx === 2) return { label, state: "rejected" };
      return { label, state: "current" };
    }
    return { label, state: "upcoming" };
  });

  const completionText =
    normalized === "approved" || normalized === "rejected"
      ? "Completed"
      : normalized === "pending"
        ? "In review"
        : "Not submitted";

  return {
    steps,
    currentIndex,
    completionText,
  };
}

function ExpenseLifecycleTracker({ status, compact = false }) {
  const lifecycle = getExpenseLifecycle(status);

  return (
    <div className={`status-progress ${compact ? "compact" : ""}`}>
      <div className="status-progress-track">
        {lifecycle.steps.map((step, idx) => (
          <Fragment key={`${step.label}-${idx}`}>
            <div className={`status-progress-step ${step.state}`}>
              <span className="status-progress-dot" />
              <span className="status-progress-label">{step.label}</span>
            </div>
            {idx < lifecycle.steps.length - 1 && (
              <span className={`status-progress-line ${idx < lifecycle.currentIndex ? "complete" : "upcoming"}`} />
            )}
          </Fragment>
        ))}
      </div>
      <span className={`status-progress-meta ${String(status || "").toLowerCase()}`}>{lifecycle.completionText}</span>
    </div>
  );
}

function ReceiptPreviewDrawer({
  open,
  previewUrl,
  previewName,
  previewMime,
  onToggle,
  onClose,
}) {
  const isPdf = previewMime === "application/pdf";

  return (
    <div className="card" style={{ padding: "0.9rem", minHeight: "240px", position: "relative" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.55rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
          <Eye size={14} />
          <span style={{ fontSize: "0.78rem", fontWeight: 700 }}>Receipt Preview</span>
        </div>
        <div style={{ display: "flex", gap: "0.25rem", alignItems: "center" }}>
          <Button size="xs" variant="ghost" onClick={onToggle}>
            {open ? "Hide" : "Show"}
          </Button>
          {previewUrl && (
            <Button size="xs" variant="ghost" onClick={onClose}>
              <X size={11} />
            </Button>
          )}
        </div>
      </div>
      <p style={{ margin: "0 0 0.55rem", fontSize: "0.7rem", color: "var(--text-muted)" }}>
        {previewName || "No receipt selected"} · <span style={{ fontWeight: 700 }}>Alt+P</span>
      </p>
      {!previewUrl || !open ? (
        <div style={{ border: "1px dashed var(--border)", borderRadius: "var(--radius-sm)", minHeight: "170px", display: "grid", placeItems: "center", color: "var(--text-muted)", fontSize: "0.76rem" }}>
          Upload a receipt to preview it here
        </div>
      ) : isPdf ? (
        <iframe
          title="Receipt PDF Preview"
          src={previewUrl}
          style={{ width: "100%", height: "320px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "white" }}
        />
      ) : (
        <img
          src={previewUrl}
          alt="Receipt preview"
          style={{ width: "100%", height: "320px", objectFit: "contain", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "var(--surface-raised)" }}
        />
      )}
    </div>
  );
}

export function EmployeePage() {
  const qc = useQueryClient();
  const toast = useToast();
  const fileRef = useRef(null);
  const [tab, setTab] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [submitWarnings, setSubmitWarnings] = useState(null); // { expenseId, description, warnings[] }
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState("");
  const [receiptPreviewName, setReceiptPreviewName] = useState("");
  const [receiptPreviewMime, setReceiptPreviewMime] = useState("");
  const [previewDrawerOpen, setPreviewDrawerOpen] = useState(true);
  const [conversionPreview, setConversionPreview] = useState(null);
  const [conversionLoading, setConversionLoading] = useState(false);
  const [conversionError, setConversionError] = useState("");
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
  const meQuery = useQuery({ queryKey: ["me"], queryFn: api.getMe });

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
      toast.success("Submission successful: expense sent for approval.", { key: "submit-success" });
      setSelectedExpense(null);
    },
    onError: (err) => toast.error(`Submission failed: ${err.message}`, { key: "submit-error" }),
  });

  const uploadMutation = useMutation({
    mutationFn: (file) => api.uploadReceipt(file),
    onSuccess: (data) => {
      if (data.is_duplicate) {
        setDuplicateWarning(data);
        toast.error("Potential duplicate receipt detected. Please review before saving.");
      } else {
        setDuplicateWarning(null);
        toast.success("Receipt scanned successfully");
      }
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
    setDuplicateWarning(null);
    if (receiptPreviewUrl) {
      URL.revokeObjectURL(receiptPreviewUrl);
    }
    setReceiptPreviewUrl("");
    setReceiptPreviewName("");
    setReceiptPreviewMime("");
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      if (!showForm) return;
      if (event.altKey && event.key.toLowerCase() === "p") {
        event.preventDefault();
        setPreviewDrawerOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showForm]);

  useEffect(() => {
    const baseCurrency = meQuery.data?.default_currency;
    const amount = Number(form.amount);
    if (!showForm || !baseCurrency || !form.currency || !Number.isFinite(amount) || amount <= 0) {
      setConversionPreview(null);
      setConversionError("");
      setConversionLoading(false);
      return;
    }

    let cancelled = false;
    setConversionLoading(true);
    setConversionError("");
    const timer = setTimeout(async () => {
      try {
        const preview = await api.previewConversion({
          amount,
          from_currency: form.currency,
          to_currency: baseCurrency,
        });
        if (!cancelled) {
          setConversionPreview(preview);
        }
      } catch (err) {
        if (!cancelled) {
          setConversionPreview(null);
          setConversionError(err.message || "Live conversion unavailable");
        }
      } finally {
        if (!cancelled) {
          setConversionLoading(false);
        }
      }
    }, 450);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [showForm, form.amount, form.currency, meQuery.data?.default_currency]);

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
    if (file) {
      if (receiptPreviewUrl) {
        URL.revokeObjectURL(receiptPreviewUrl);
      }
      setReceiptPreviewUrl(URL.createObjectURL(file));
      setReceiptPreviewName(file.name || "receipt");
      setReceiptPreviewMime(file.type || "");
      setPreviewDrawerOpen(true);
      uploadMutation.mutate(file);
    }
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

  const detailWarnings = useMemo(() => {
    if (!selectedExpense?.expense) return [];
    return buildPolicyWarnings(selectedExpense.expense, selectedExpense);
  }, [selectedExpense]);

  const submitWithPolicyCheck = async (expense) => {
    let detail = null;
    try {
      detail = await api.getExpenseDetail(expense.id);
    } catch {
      detail = null;
    }

    const warnings = buildPolicyWarnings(expense, detail);
    if (warnings.length > 0) {
      setSubmitWarnings({
        expenseId: expense.id,
        description: expense.description,
        warnings,
      });
      toast.info("Submitted with policy warnings. Please review details.", { key: `policy-warning-${expense.id}` });
    } else {
      setSubmitWarnings(null);
    }

    submitMutation.mutate(expense.id);
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
          {duplicateWarning && (
            <div className="policy-warning-banner" style={{ marginBottom: "1rem", borderColor: "rgba(239, 68, 68, 0.45)" }}>
              <div style={{ display: "flex", gap: "0.55rem", alignItems: "flex-start" }}>
                <AlertTriangle size={15} style={{ color: "var(--danger)", marginTop: "0.1rem", flexShrink: 0 }} />
                <div>
                  <p style={{ margin: 0, fontSize: "0.8rem", fontWeight: 700, color: "var(--danger)" }}>
                    Potential duplicate receipt detected
                  </p>
                  <p style={{ margin: "0.25rem 0 0", fontSize: "0.76rem", color: "var(--text-secondary)" }}>
                    Similar to: <strong>{duplicateWarning.duplicate_description || "existing expense"}</strong>
                    {duplicateWarning.duplicate_amount != null && duplicateWarning.duplicate_currency
                      ? ` (${duplicateWarning.duplicate_amount} ${duplicateWarning.duplicate_currency})`
                      : ""}
                    {duplicateWarning.duplicate_date ? ` on ${duplicateWarning.duplicate_date}` : ""}.
                  </p>
                  <p style={{ margin: "0.2rem 0 0", fontSize: "0.74rem", color: "var(--text-muted)" }}>
                    This is a warning only. You can still save the draft if this is intentional.
                  </p>
                </div>
              </div>
            </div>
          )}
          <div className="expense-form-drawer-grid" style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1rem" }}>
            <div>
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
                  <div className="policy-warning-banner" style={{ marginTop: "0.2rem" }}>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: "0.8rem", color: "var(--text-primary)" }}>
                      Live Conversion Preview
                    </p>
                    {conversionLoading ? (
                      <p style={{ margin: "0.3rem 0 0", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                        Fetching latest exchange rate...
                      </p>
                    ) : conversionError ? (
                      <p style={{ margin: "0.3rem 0 0", fontSize: "0.78rem", color: "var(--danger)" }}>
                        {conversionError}
                      </p>
                    ) : conversionPreview ? (
                      <div style={{ marginTop: "0.3rem" }}>
                        <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                          {conversionPreview.amount} {conversionPreview.from_currency} ≈{" "}
                          <strong style={{ color: "var(--text-primary)" }}>
                            {conversionPreview.converted_amount} {conversionPreview.to_currency}
                          </strong>
                        </p>
                        <p style={{ margin: "0.2rem 0 0", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                          Rate: 1 {conversionPreview.from_currency} = {conversionPreview.rate} {conversionPreview.to_currency}
                          {" · "}
                          {new Date(conversionPreview.as_of).toLocaleString()}
                        </p>
                        {conversionPreview.fallback && (
                          <p style={{ margin: "0.2rem 0 0", fontSize: "0.75rem", color: "var(--warning)" }}>
                            {conversionPreview.message || "Using resilient fallback conversion."}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p style={{ margin: "0.3rem 0 0", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                        Enter an amount to preview conversion to company base currency.
                      </p>
                    )}
                  </div>
                </div>
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
            <ReceiptPreviewDrawer
              open={previewDrawerOpen}
              previewUrl={receiptPreviewUrl}
              previewName={receiptPreviewName}
              previewMime={receiptPreviewMime}
              onToggle={() => setPreviewDrawerOpen((prev) => !prev)}
              onClose={() => {
                if (receiptPreviewUrl) {
                  URL.revokeObjectURL(receiptPreviewUrl);
                }
                setReceiptPreviewUrl("");
                setReceiptPreviewName("");
                setReceiptPreviewMime("");
              }}
            />
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

      {submitWarnings && (
        <div className="policy-warning-banner" style={{ marginBottom: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: "1rem" }}>
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: "0.82rem", color: "var(--warning)" }}>
                Policy Warnings (non-blocking)
              </p>
              <p style={{ margin: "0.25rem 0 0", fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                {submitWarnings.description}
              </p>
            </div>
            <Button size="xs" variant="ghost" onClick={() => setSubmitWarnings(null)}>Dismiss</Button>
          </div>
          <ul style={{ margin: "0.5rem 0 0", paddingLeft: "1rem", color: "var(--text-secondary)", fontSize: "0.78rem" }}>
            {submitWarnings.warnings.map((warning) => (
              <li key={warning} style={{ marginBottom: "0.2rem" }}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="card" style={{ overflow: "hidden" }}>
        <div className="expense-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th>Date</th>
                <th>Category</th>
                <th>Amount</th>
                <th>Company Amount</th>
                <th>Status</th>
                <th>Progress</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="empty-state">No expenses found{tab !== "all" ? ` with status "${tab}"` : ""}.</td></tr>
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
                      <ExpenseLifecycleTracker status={item.status} compact />
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "0.35rem" }}>
                        <Button size="xs" onClick={() => loadDetail(item)}>
                          <FileText size={11} /> View
                        </Button>
                        {item.status === "draft" && (
                          <Button size="xs" variant="primary" onClick={() => submitWithPolicyCheck(item)}>
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

        <div className="expense-mobile-list">
          {filtered.length === 0 ? (
            <div className="empty-state">No expenses found{tab !== "all" ? ` with status "${tab}"` : ""}.</div>
          ) : (
            filtered.map((item) => (
              <div key={item.id} className="expense-mobile-card">
                <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "flex-start" }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: "0.9rem", color: "var(--text-primary)" }}>{item.description}</p>
                    <p style={{ margin: "0.2rem 0 0", fontSize: "0.76rem", color: "var(--text-secondary)" }}>
                      {new Date(item.expense_date).toLocaleDateString()} · {item.category}
                    </p>
                  </div>
                  <Badge status={item.status}>{item.status}</Badge>
                </div>

                <div style={{ marginTop: "0.6rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.35rem" }}>
                  <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                    Amount: <strong style={{ color: "var(--text-primary)" }}>{item.amount} {item.currency}</strong>
                  </p>
                  <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-secondary)", textAlign: "right" }}>
                    Company: <strong style={{ color: "var(--text-primary)" }}>{item.converted_amount} {item.base_currency}</strong>
                  </p>
                </div>

                <div style={{ marginTop: "0.7rem" }}>
                  <ExpenseLifecycleTracker status={item.status} />
                </div>

                <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.4rem" }}>
                  <Button size="xs" onClick={() => loadDetail(item)}>
                    <FileText size={11} /> View
                  </Button>
                  {item.status === "draft" && (
                    <Button size="xs" variant="primary" onClick={() => submitWithPolicyCheck(item)}>
                      <Send size={11} /> Submit
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
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

            <div style={{ marginBottom: "1.5rem" }}>
              <span className="label">Approval Progress</span>
              <ExpenseLifecycleTracker status={selectedExpense.expense.status} />
            </div>

            {detailWarnings.length > 0 && (
              <div className="policy-warning-banner" style={{ marginBottom: "1.25rem" }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: "0.82rem", color: "var(--warning)" }}>
                  Policy Warnings (non-blocking)
                </p>
                <ul style={{ margin: "0.45rem 0 0", paddingLeft: "1rem", color: "var(--text-secondary)", fontSize: "0.8rem" }}>
                  {detailWarnings.map((warning) => (
                    <li key={warning} style={{ marginBottom: "0.25rem" }}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}

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
                <Button variant="primary" onClick={() => submitWithPolicyCheck(selectedExpense.expense)}>
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
