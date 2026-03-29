import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "../context/toast-context";
import { AppShell } from "../components/layout/app-shell";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Modal } from "../components/ui/modal";
import { Textarea } from "../components/ui/textarea";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { api } from "../lib/api";
import {
  CheckCircle, XCircle, Eye, Clock, DollarSign,
  ChevronDown, ChevronUp, Filter,
  ChevronsLeft, ChevronsRight, ChevronLeft, ChevronRight,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";

/* ─── Constants & Helpers ──────────────────────── */

const BAR_COLORS = ["#1e40af", "#059669", "#d97706", "#dc2626", "#7c3aed", "#0891b2"];
const PRESET_STORAGE_KEY = "rms_manager_filter_presets";
const PAGE_SIZE_OPTIONS = [10, 25, 50];

const defaultFilters = {
  search: "",
  status: "all",
  category: "all",
  userId: "all",
  dateRange: "all",
  fromDate: "",
  toDate: "",
};

function loadPresets() {
  try {
    const raw = localStorage.getItem(PRESET_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && item.name && item.filters);
  } catch {
    return [];
  }
}

/* ─── Pagination Component ────────────────────── */

function Pagination({ total, page, pageSize, onPageChange, onPageSizeChange }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0.75rem 1rem", borderTop: "1px solid var(--border)",
      fontSize: "0.78rem", color: "var(--text-secondary)", flexWrap: "wrap", gap: "0.5rem",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <span>Rows per page:</span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          style={{
            padding: "0.2rem 0.4rem", borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border)", fontSize: "0.78rem",
            background: "var(--surface)", color: "var(--text-primary)",
          }}
        >
          {PAGE_SIZE_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <span>{from}–{to} of {total}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
        <button className="btn btn-ghost btn-xs" disabled={page <= 1} onClick={() => onPageChange(1)} title="First page">
          <ChevronsLeft size={14} />
        </button>
        <button className="btn btn-ghost btn-xs" disabled={page <= 1} onClick={() => onPageChange(page - 1)} title="Previous">
          <ChevronLeft size={14} />
        </button>
        <span style={{ padding: "0 0.5rem", fontWeight: 600, fontSize: "0.78rem" }}>
          {page} / {totalPages}
        </span>
        <button className="btn btn-ghost btn-xs" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} title="Next">
          <ChevronRight size={14} />
        </button>
        <button className="btn btn-ghost btn-xs" disabled={page >= totalPages} onClick={() => onPageChange(totalPages)} title="Last page">
          <ChevronsRight size={14} />
        </button>
      </div>
    </div>
  );
}

/* ─── Dashboard Widgets ────────────────────────── */

function DashStatCard({ icon, iconColor, label, value, sub }) {
  return (
    <div className="dash-stat-card">
      <div className={`dash-stat-icon ${iconColor}`}>{icon}</div>
      <div className="dash-stat-content">
        <div className="dash-stat-label">{label}</div>
        <div className="dash-stat-value">{value}</div>
        {sub && <div className="dash-stat-sub">{sub}</div>}
      </div>
    </div>
  );
}

function CategoryBarChart({ expenses }) {
  const data = useMemo(() => {
    const cats = {};
    expenses.forEach((exp) => {
      const cat = exp.category || "Other";
      cats[cat] = (cats[cat] || 0) + Number(exp.converted_amount || 0);
    });
    return Object.entries(cats)
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value);
  }, [expenses]);

  if (data.length === 0) {
    return (
      <div className="dashboard-chart-card">
        <h4>Team Spend by Category</h4>
        <div style={{ height: 220, display: "grid", placeItems: "center", color: "var(--text-muted)", fontSize: "0.8rem" }}>
          No data yet
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-chart-card">
      <h4>Team Spend by Category</h4>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 5, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11, fill: "#9ca3af" }} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#4b5563" }} width={80} />
          <Tooltip />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} name="Amount">
            {data.map((_, idx) => (
              <Cell key={idx} fill={BAR_COLORS[idx % BAR_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ApprovalPipeline({ expenses }) {
  const counts = useMemo(() => {
    const c = { draft: 0, pending: 0, approved: 0, rejected: 0 };
    expenses.forEach((e) => { if (c[e.status] !== undefined) c[e.status]++; });
    return c;
  }, [expenses]);

  return (
    <div className="dashboard-chart-card">
      <h4>Approval Pipeline</h4>
      <div className="pipeline-bar">
        {counts.draft > 0 && <div className="pipeline-segment draft" style={{ flex: counts.draft }}>{counts.draft}</div>}
        {counts.pending > 0 && <div className="pipeline-segment pending" style={{ flex: counts.pending }}>{counts.pending}</div>}
        {counts.approved > 0 && <div className="pipeline-segment approved" style={{ flex: counts.approved }}>{counts.approved}</div>}
        {counts.rejected > 0 && <div className="pipeline-segment rejected" style={{ flex: counts.rejected }}>{counts.rejected}</div>}
      </div>
      <div className="pipeline-legend">
        <div className="pipeline-legend-item"><span className="pipeline-legend-dot" style={{ background: "#9ca3af" }} /> Draft ({counts.draft})</div>
        <div className="pipeline-legend-item"><span className="pipeline-legend-dot" style={{ background: "#d97706" }} /> Pending ({counts.pending})</div>
        <div className="pipeline-legend-item"><span className="pipeline-legend-dot" style={{ background: "#059669" }} /> Approved ({counts.approved})</div>
        <div className="pipeline-legend-item"><span className="pipeline-legend-dot" style={{ background: "#dc2626" }} /> Rejected ({counts.rejected})</div>
      </div>
      <p style={{ margin: "0.75rem 0 0", fontSize: "0.74rem", color: "var(--text-muted)" }}>
        Approval rate: {expenses.length > 0 ? Math.round((counts.approved / expenses.length) * 100) : 0}% · {expenses.length} total
      </p>
    </div>
  );
}

function TopSpendersWidget({ expenses }) {
  const spenders = useMemo(() => {
    const map = {};
    expenses.forEach((exp) => {
      const key = exp.user_id;
      if (!map[key]) map[key] = { name: exp.user_name || `User #${exp.user_id}`, total: 0, count: 0 };
      map[key].total += Number(exp.converted_amount || 0);
      map[key].count++;
    });
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [expenses]);

  return (
    <div className="dashboard-chart-card">
      <h4>Top Spenders</h4>
      {spenders.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>No data yet</p>
      ) : (
        <table className="top-spenders-table">
          <thead>
            <tr><th>#</th><th>Employee</th><th>Expenses</th><th style={{ textAlign: "right" }}>Total</th></tr>
          </thead>
          <tbody>
            {spenders.map((s, idx) => (
              <tr key={s.name}>
                <td><span className="top-spenders-rank">{idx + 1}</span></td>
                <td style={{ fontWeight: 600 }}>{s.name}</td>
                <td style={{ color: "var(--text-secondary)" }}>{s.count}</td>
                <td style={{ textAlign: "right", fontWeight: 700 }}>{s.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ─── Main Page ─────────────────────────────────── */

export function ManagerPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [commentModal, setCommentModal] = useState(null);
  const [comment, setComment] = useState("");
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [filters, setFilters] = useState(defaultFilters);
  const [sortConfig, setSortConfig] = useState({ key: "expense_date", direction: "desc" });
  const [savedPresets, setSavedPresets] = useState(() => loadPresets());
  const [presetName, setPresetName] = useState("");
  const [activePreset, setActivePreset] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const teamQuery = useQuery({ queryKey: ["team-expenses"], queryFn: api.teamExpenses });

  const approveMutation = useMutation({
    mutationFn: ({ id, comment }) => api.approve(id, comment),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team-expenses"] });
      toast.success("Approval successful: expense marked as approved.", { key: "approve-success" });
      setCommentModal(null); setComment("");
    },
    onError: (err) => toast.error(`Approval failed: ${err.message}`, { key: "approve-error" }),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, comment }) => api.reject(id, comment),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team-expenses"] });
      toast.success("Rejection successful: expense marked as rejected.", { key: "reject-success" });
      setCommentModal(null); setComment("");
    },
    onError: (err) => toast.error(`Rejection failed: ${err.message}`, { key: "reject-error" }),
  });

  const handleAction = () => {
    if (!commentModal) return;
    if (commentModal.action === "approve") approveMutation.mutate({ id: commentModal.id, comment });
    else rejectMutation.mutate({ id: commentModal.id, comment });
  };

  const loadDetail = async (expense) => {
    try { const detail = await api.getExpenseDetail(expense.id); setSelectedExpense(detail); }
    catch { setSelectedExpense({ expense, approval_logs: [] }); }
  };

  const expenses = teamQuery.data || [];

  /* ─── Dashboard computed stats ─── */
  const dashStats = useMemo(() => {
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    let pendingCount = 0, pendingAmount = 0, approvedMonth = 0, approvedMonthCount = 0;
    let rejectedMonth = 0, rejectedMonthCount = 0, totalSpend = 0;

    expenses.forEach((exp) => {
      const amt = Number(exp.converted_amount || 0);
      totalSpend += amt;
      const expMonth = exp.expense_date ? exp.expense_date.slice(0, 7) : "";
      if (exp.status === "pending") { pendingCount++; pendingAmount += amt; }
      if (exp.status === "approved" && expMonth === thisMonth) { approvedMonthCount++; approvedMonth += amt; }
      if (exp.status === "rejected" && expMonth === thisMonth) { rejectedMonthCount++; rejectedMonth += amt; }
    });

    return { pendingCount, pendingAmount, approvedMonth, approvedMonthCount, rejectedMonth, rejectedMonthCount, totalSpend };
  }, [expenses]);

  /* ─── Filters ─── */
  const statusOptions = useMemo(() => {
    const statuses = new Set(expenses.map((item) => item.status).filter(Boolean));
    return ["all", ...Array.from(statuses)];
  }, [expenses]);

  const categoryOptions = useMemo(() => {
    const categories = new Set(expenses.map((item) => item.category).filter(Boolean));
    return ["all", ...Array.from(categories).sort((a, b) => a.localeCompare(b))];
  }, [expenses]);

  const userOptions = useMemo(() => {
    const unique = new Map();
    expenses.forEach((item) => {
      const key = String(item.user_id);
      if (!unique.has(key)) unique.set(key, { id: key, label: item.user_name || `User #${item.user_id}` });
    });
    return [{ id: "all", label: "All users" }, ...Array.from(unique.values()).sort((a, b) => a.label.localeCompare(b.label))];
  }, [expenses]);

  const filteredSorted = useMemo(() => {
    const query = filters.search.trim().toLowerCase();
    const now = new Date();

    const result = expenses.filter((item) => {
      if (filters.status !== "all" && item.status !== filters.status) return false;
      if (filters.category !== "all" && item.category !== filters.category) return false;
      if (filters.userId !== "all" && String(item.user_id) !== filters.userId) return false;

      const itemDate = new Date(item.expense_date);
      if (filters.dateRange !== "all") {
        if (Number.isNaN(itemDate.getTime())) return false;
        if (filters.dateRange === "last7") { const s = new Date(now); s.setDate(now.getDate() - 7); if (itemDate < s) return false; }
        if (filters.dateRange === "last30") { const s = new Date(now); s.setDate(now.getDate() - 30); if (itemDate < s) return false; }
        if (filters.dateRange === "thisMonth") { if (itemDate.getMonth() !== now.getMonth() || itemDate.getFullYear() !== now.getFullYear()) return false; }
        if (filters.dateRange === "custom") {
          if (filters.fromDate && itemDate < new Date(`${filters.fromDate}T00:00:00`)) return false;
          if (filters.toDate && itemDate > new Date(`${filters.toDate}T23:59:59`)) return false;
        }
      }

      if (!query) return true;
      const searchable = [item.description, item.user_name, String(item.user_id), item.category, item.status, item.currency, item.base_currency, String(item.amount), String(item.converted_amount)].filter(Boolean).join(" ").toLowerCase();
      return searchable.includes(query);
    });

    const sorted = [...result].sort((a, b) => {
      let aV, bV;
      switch (sortConfig.key) {
        case "user_name": aV = (a.user_name || "").toLowerCase(); bV = (b.user_name || "").toLowerCase(); break;
        case "category": case "status": case "description": aV = (a[sortConfig.key] || "").toLowerCase(); bV = (b[sortConfig.key] || "").toLowerCase(); break;
        case "amount": aV = Number(a.converted_amount) || 0; bV = Number(b.converted_amount) || 0; break;
        default: aV = new Date(a.expense_date).getTime() || 0; bV = new Date(b.expense_date).getTime() || 0; break;
      }
      if (aV < bV) return sortConfig.direction === "asc" ? -1 : 1;
      if (aV > bV) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [expenses, filters, sortConfig]);

  // Reset page when filters change
  const filteredCount = filteredSorted.length;
  const totalPages = Math.max(1, Math.ceil(filteredCount / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedData = filteredSorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  const pendingCount = filteredSorted.filter((item) => item.status === "pending").length;
  const resolvedCount = filteredSorted.filter((item) => item.status !== "pending" && item.status !== "draft").length;

  const activeFilterCount = Object.entries(filters).filter(([k, v]) => {
    if (k === "search") return v.trim() !== "";
    if (k === "fromDate" || k === "toDate") return v !== "";
    return v !== "all" && v !== defaultFilters[k];
  }).length;

  const updatePresetStorage = (nextPresets) => { setSavedPresets(nextPresets); localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(nextPresets)); };
  const savePreset = () => {
    const name = presetName.trim();
    if (!name) { toast.error("Enter a preset name before saving"); return; }
    updatePresetStorage([...savedPresets.filter((i) => i.name !== name), { name, filters }]);
    setActivePreset(name); setPresetName(""); toast.success(`Preset "${name}" saved`);
  };
  const applyPreset = (name) => {
    setActivePreset(name);
    if (name === "") { setFilters(defaultFilters); return; }
    const preset = savedPresets.find((i) => i.name === name);
    if (preset) setFilters({ ...defaultFilters, ...preset.filters });
  };
  const deleteActivePreset = () => {
    if (!activePreset) return;
    updatePresetStorage(savedPresets.filter((i) => i.name !== activePreset));
    setActivePreset(""); toast.success("Preset deleted");
  };
  const setSort = (key) => setSortConfig((prev) => prev.key === key ? { key, direction: prev.direction === "asc" ? "desc" : "asc" } : { key, direction: "asc" });
  const sortIndicator = (key) => sortConfig.key !== key ? "" : sortConfig.direction === "asc" ? " ▲" : " ▼";

  return (
    <AppShell>
      {/* Header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h2 className="font-display" style={{ fontSize: "1.5rem" }}>Approvals to Review</h2>
        <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginTop: "0.2rem" }}>
          {pendingCount} pending approval{pendingCount !== 1 ? "s" : ""} · {resolvedCount} resolved · {filteredSorted.length} shown
        </p>
      </div>

      {/* ═══ Dashboard Section ═══ */}
      <div className="dashboard-stats-grid">
        <DashStatCard icon={<Clock size={20} />} iconColor="amber" label="Pending Reviews" value={dashStats.pendingCount} sub={`${dashStats.pendingAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })} total`} />
        <DashStatCard icon={<CheckCircle size={20} />} iconColor="green" label="Approved (Month)" value={dashStats.approvedMonthCount} sub={`${dashStats.approvedMonth.toLocaleString(undefined, { maximumFractionDigits: 0 })} reimbursed`} />
        <DashStatCard icon={<XCircle size={20} />} iconColor="red" label="Rejected (Month)" value={dashStats.rejectedMonthCount} sub={`${dashStats.rejectedMonth.toLocaleString(undefined, { maximumFractionDigits: 0 })} declined`} />
        <DashStatCard icon={<DollarSign size={20} />} iconColor="navy" label="Total Team Spend" value={dashStats.totalSpend.toLocaleString(undefined, { maximumFractionDigits: 0 })} sub={`${expenses.length} expenses`} />
      </div>

      <div className="dashboard-charts-grid">
        <CategoryBarChart expenses={expenses} />
        <ApprovalPipeline expenses={expenses} />
      </div>

      <div style={{ marginBottom: "1.5rem" }}>
        <TopSpendersWidget expenses={expenses} />
      </div>

      {/* ═══ Collapsible Filters ═══ */}
      <div className="card" style={{ marginBottom: "1rem", overflow: "hidden" }}>
        <button
          onClick={() => setFiltersOpen(!filtersOpen)}
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "0.85rem 1rem", background: "none", border: "none", cursor: "pointer",
            fontFamily: "var(--font-body)", fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Filter size={14} />
            Filters & Presets
            {activeFilterCount > 0 && (
              <span style={{
                background: "var(--accent)", color: "white", fontSize: "0.65rem", fontWeight: 700,
                padding: "0.1rem 0.4rem", borderRadius: "100px", lineHeight: 1.4,
              }}>
                {activeFilterCount}
              </span>
            )}
          </span>
          {filtersOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {filtersOpen && (
          <div style={{ padding: "0 1rem 1rem", borderTop: "1px solid var(--border)" }}>
            <div className="manager-filter-grid" style={{ display: "grid", gap: "0.75rem", marginBottom: "0.75rem", marginTop: "0.75rem" }}>
              <Input label="Search" placeholder="Search by subject, user, category, status, amount..." value={filters.search} onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))} />
              <Select label="Status" value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}>
                {statusOptions.map((s) => <option key={s} value={s}>{s === "all" ? "All statuses" : s}</option>)}
              </Select>
              <Select label="Category" value={filters.category} onChange={(e) => setFilters((p) => ({ ...p, category: e.target.value }))}>
                {categoryOptions.map((c) => <option key={c} value={c}>{c === "all" ? "All categories" : c}</option>)}
              </Select>
              <Select label="User" value={filters.userId} onChange={(e) => setFilters((p) => ({ ...p, userId: e.target.value }))}>
                {userOptions.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
              </Select>
            </div>

            <div className="manager-range-grid" style={{ display: "grid", gap: "0.75rem", alignItems: "end", marginBottom: "1rem" }}>
              <Select label="Date Range" value={filters.dateRange} onChange={(e) => setFilters((p) => ({ ...p, dateRange: e.target.value }))}>
                <option value="all">All dates</option>
                <option value="last7">Last 7 days</option>
                <option value="last30">Last 30 days</option>
                <option value="thisMonth">This month</option>
                <option value="custom">Custom</option>
              </Select>
              <Input label="From" type="date" disabled={filters.dateRange !== "custom"} value={filters.fromDate} onChange={(e) => setFilters((p) => ({ ...p, fromDate: e.target.value }))} />
              <Input label="To" type="date" disabled={filters.dateRange !== "custom"} value={filters.toDate} onChange={(e) => setFilters((p) => ({ ...p, toDate: e.target.value }))} />
              <Button onClick={() => { setFilters(defaultFilters); setActivePreset(""); setPage(1); }}>Reset Filters</Button>
              <Button variant="ghost" onClick={() => setSortConfig({ key: "expense_date", direction: "desc" })}>Reset Sort</Button>
            </div>

            <hr className="divider" />

            <div className="manager-preset-grid" style={{ display: "grid", gap: "0.75rem", alignItems: "end", marginTop: "0.75rem" }}>
              <Input label="Save Current Filters As" placeholder="e.g., Pending Travel This Month" value={presetName} onChange={(e) => setPresetName(e.target.value)} />
              <Select label="Saved Presets" value={activePreset} onChange={(e) => applyPreset(e.target.value)}>
                <option value="">None</option>
                {savedPresets.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
              </Select>
              <Button variant="primary" onClick={savePreset}>Save Preset</Button>
              <Button variant="danger" onClick={deleteActivePreset} disabled={!activePreset}>Delete Preset</Button>
            </div>
          </div>
        )}
      </div>

      {/* ═══ Table with Pagination ═══ */}
      <div className="card" style={{ overflow: "hidden", marginBottom: "1.5rem" }}>
        <div className="manager-table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ cursor: "pointer" }} onClick={() => setSort("description")}>Subject{sortIndicator("description")}</th>
                <th style={{ cursor: "pointer" }} onClick={() => setSort("user_name")}>Request Owner{sortIndicator("user_name")}</th>
                <th style={{ cursor: "pointer" }} onClick={() => setSort("category")}>Category{sortIndicator("category")}</th>
                <th style={{ cursor: "pointer" }} onClick={() => setSort("expense_date")}>Date{sortIndicator("expense_date")}</th>
                <th style={{ cursor: "pointer" }} onClick={() => setSort("status")}>Status{sortIndicator("status")}</th>
                <th style={{ cursor: "pointer" }} onClick={() => setSort("amount")}>Amount (Company){sortIndicator("amount")}</th>
                <th style={{ width: "200px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagedData.length === 0 ? (
                <tr><td colSpan={7} className="empty-state">No expenses match the current filters.</td></tr>
              ) : (
                pagedData.map((item) => (
                  <tr key={item.id} style={{ opacity: item.status === "pending" ? 1 : 0.75 }}>
                    <td style={{ fontWeight: 600 }}>{item.description}</td>
                    <td style={{ color: "var(--text-secondary)" }}>{item.user_name || `User #${item.user_id}`}</td>
                    <td>{item.category}</td>
                    <td style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>{new Date(item.expense_date).toLocaleDateString()}</td>
                    <td><Badge status={item.status}>{item.status}</Badge></td>
                    <td>
                      <span style={{ fontSize: "0.72rem", color: "var(--accent)", textDecoration: "line-through", marginRight: "0.5rem" }}>{item.amount} {item.currency}</span>
                      <span style={{ fontWeight: 700 }}>{item.converted_amount} {item.base_currency}</span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "0.35rem" }}>
                        <Button size="xs" onClick={() => loadDetail(item)}><Eye size={11} /></Button>
                        {item.status === "pending" ? (
                          <>
                            <Button size="xs" variant="success" onClick={() => setCommentModal({ id: item.id, action: "approve" })}><CheckCircle size={11} /> Approve</Button>
                            <Button size="xs" variant="danger" onClick={() => setCommentModal({ id: item.id, action: "reject" })}><XCircle size={11} /> Reject</Button>
                          </>
                        ) : (
                          <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>No actions</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="manager-mobile-list">
          {pagedData.length === 0 ? (
            <div className="empty-state">No expenses match the current filters.</div>
          ) : (
            pagedData.map((item) => (
              <div key={item.id} className="manager-mobile-card">
                <div style={{ display: "flex", justifyContent: "space-between", gap: "0.6rem", alignItems: "flex-start" }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, color: "var(--text-primary)", fontSize: "0.9rem" }}>{item.description}</p>
                    <p style={{ margin: "0.22rem 0 0", color: "var(--text-secondary)", fontSize: "0.76rem" }}>{(item.user_name || `User #${item.user_id}`)} · {item.category}</p>
                    <p style={{ margin: "0.18rem 0 0", color: "var(--text-muted)", fontSize: "0.72rem" }}>{new Date(item.expense_date).toLocaleDateString()}</p>
                  </div>
                  <Badge status={item.status}>{item.status}</Badge>
                </div>
                <div style={{ marginTop: "0.65rem", display: "flex", alignItems: "baseline", gap: "0.4rem", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "0.72rem", color: "var(--accent)", textDecoration: "line-through" }}>{item.amount} {item.currency}</span>
                  <span style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: "0.92rem" }}>{item.converted_amount} {item.base_currency}</span>
                </div>
                <div className="manager-mobile-actions">
                  <Button size="xs" onClick={() => loadDetail(item)}><Eye size={11} /> View</Button>
                  {item.status === "pending" ? (
                    <>
                      <Button size="xs" variant="success" onClick={() => setCommentModal({ id: item.id, action: "approve" })}><CheckCircle size={11} /> Approve</Button>
                      <Button size="xs" variant="danger" onClick={() => setCommentModal({ id: item.id, action: "reject" })}><XCircle size={11} /> Reject</Button>
                    </>
                  ) : (
                    <span style={{ color: "var(--text-muted)", fontSize: "0.74rem", fontWeight: 600 }}>No pending actions</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        <Pagination
          total={filteredCount}
          page={safePage}
          pageSize={pageSize}
          onPageChange={(p) => setPage(p)}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        />
      </div>

      {/* Comment / Decision Modal */}
      <Modal open={!!commentModal} onClose={() => { setCommentModal(null); setComment(""); }} title={commentModal?.action === "approve" ? "Approve Expense" : "Reject Expense"}>
        <Textarea label="Comment (optional)" placeholder="Add a note about your decision..." value={comment} onChange={(e) => setComment(e.target.value)} />
        <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem" }}>
          <Button variant={commentModal?.action === "approve" ? "success" : "danger"} onClick={handleAction}>
            {commentModal?.action === "approve" ? <><CheckCircle size={14} /> Confirm Approval</> : <><XCircle size={14} /> Confirm Rejection</>}
          </Button>
          <Button onClick={() => { setCommentModal(null); setComment(""); }}>Cancel</Button>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal open={!!selectedExpense} onClose={() => setSelectedExpense(null)} title={`Expense: ${selectedExpense?.expense?.description || ""}`}>
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
                <thead><tr><th>Approver</th><th>Decision</th><th>Comment</th><th>Time</th></tr></thead>
                <tbody>
                  {selectedExpense.approval_logs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ fontWeight: 600 }}>{log.approver_name}</td>
                      <td><Badge status={log.decision}>{log.decision}</Badge></td>
                      <td style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>{log.comment || "—"}</td>
                      <td style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>{new Date(log.timestamp).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </Modal>
    </AppShell>
  );
}
