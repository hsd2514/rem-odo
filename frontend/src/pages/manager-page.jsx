import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "../context/toast-context";
import { useAuth } from "../context/auth-context";
import { AppShell } from "../components/layout/app-shell";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Checkbox } from "../components/ui/checkbox";
import { Modal } from "../components/ui/modal";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { api } from "../lib/api";
import { CheckCircle, XCircle, Eye } from "lucide-react";

const PRESET_STORAGE_KEY = "rms_manager_filter_presets";

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

export function ManagerPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { userId } = useAuth();
  const currentUserId = Number(userId);
  const [selectedRows, setSelectedRows] = useState(() => new Set());
  const [inlineComments, setInlineComments] = useState({});
  const [bulkActionInFlight, setBulkActionInFlight] = useState(null);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [filters, setFilters] = useState(defaultFilters);
  const [sortConfig, setSortConfig] = useState({ key: "expense_date", direction: "desc" });
  const [savedPresets, setSavedPresets] = useState(() => loadPresets());
  const [presetName, setPresetName] = useState("");
  const [activePreset, setActivePreset] = useState("");

  const teamQuery = useQuery({ queryKey: ["team-expenses"], queryFn: api.teamExpenses });

  const decisionMutation = useMutation({
    mutationFn: ({ id, action, comment }) => {
      if (action === "approve") {
        return api.approve(id, comment);
      }
      return api.reject(id, comment);
    },
    onMutate: async ({ id, action }) => {
      await qc.cancelQueries({ queryKey: ["team-expenses"] });
      const previousExpenses = qc.getQueryData(["team-expenses"]);

      qc.setQueryData(["team-expenses"], (old = []) =>
        old.map((expense) =>
          expense.id === id
            ? { ...expense, status: action === "approve" ? "approved" : "rejected" }
            : expense,
        ),
      );

      return { previousExpenses };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousExpenses) {
        qc.setQueryData(["team-expenses"], context.previousExpenses);
      }
    },
  });

  const loadDetail = async (expense) => {
    try {
      const detail = await api.getExpenseDetail(expense.id);
      setSelectedExpense(detail);
    } catch {
      setSelectedExpense({ expense, approval_logs: [] });
    }
  };

  const expenses = teamQuery.data || [];

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
      if (!unique.has(key)) {
        unique.set(key, {
          id: key,
          label: item.user_name || `User #${item.user_id}`,
        });
      }
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
      const itemTs = itemDate.getTime();

      if (filters.dateRange !== "all") {
        if (Number.isNaN(itemTs)) return false;

        if (filters.dateRange === "last7") {
          const start = new Date(now);
          start.setDate(now.getDate() - 7);
          if (itemDate < start) return false;
        }

        if (filters.dateRange === "last30") {
          const start = new Date(now);
          start.setDate(now.getDate() - 30);
          if (itemDate < start) return false;
        }

        if (filters.dateRange === "thisMonth") {
          if (
            itemDate.getMonth() !== now.getMonth() ||
            itemDate.getFullYear() !== now.getFullYear()
          ) {
            return false;
          }
        }

        if (filters.dateRange === "custom") {
          if (filters.fromDate) {
            const start = new Date(`${filters.fromDate}T00:00:00`);
            if (itemDate < start) return false;
          }
          if (filters.toDate) {
            const end = new Date(`${filters.toDate}T23:59:59`);
            if (itemDate > end) return false;
          }
        }
      }

      if (!query) return true;

      const searchable = [
        item.description,
        item.user_name,
        String(item.user_id),
        item.category,
        item.status,
        item.currency,
        item.base_currency,
        String(item.amount),
        String(item.converted_amount),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });

    const sorted = [...result].sort((a, b) => {
      let aValue;
      let bValue;

      switch (sortConfig.key) {
        case "user_name":
          aValue = (a.user_name || `User #${a.user_id}`).toLowerCase();
          bValue = (b.user_name || `User #${b.user_id}`).toLowerCase();
          break;
        case "category":
        case "status":
        case "description":
          aValue = (a[sortConfig.key] || "").toLowerCase();
          bValue = (b[sortConfig.key] || "").toLowerCase();
          break;
        case "amount":
          aValue = Number(a.converted_amount) || 0;
          bValue = Number(b.converted_amount) || 0;
          break;
        case "expense_date":
        default:
          aValue = new Date(a.expense_date).getTime() || 0;
          bValue = new Date(b.expense_date).getTime() || 0;
          break;
      }

      if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [expenses, filters, sortConfig]);

  const pendingVisibleIds = useMemo(
    () => filteredSorted.filter((item) => item.status === "pending").map((item) => item.id),
    [filteredSorted],
  );

  const selectedPendingIds = useMemo(
    () => pendingVisibleIds.filter((id) => selectedRows.has(id)),
    [pendingVisibleIds, selectedRows],
  );

  const areAllPendingVisibleSelected =
    pendingVisibleIds.length > 0 && selectedPendingIds.length === pendingVisibleIds.length;

  const hasAnySelection = selectedPendingIds.length > 0;

  const setRowSelected = (id, checked) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const toggleSelectAllPendingVisible = (checked) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      pendingVisibleIds.forEach((id) => {
        if (checked) {
          next.add(id);
        } else {
          next.delete(id);
        }
      });
      return next;
    });
  };

  const clearCommentsForIds = (ids) => {
    setInlineComments((prev) => {
      const next = { ...prev };
      ids.forEach((id) => {
        delete next[id];
      });
      return next;
    });
  };

  const clearSelectionForIds = (ids) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  };

  const canCurrentUserActOnExpense = async (expenseId) => {
    if (!currentUserId) {
      return { canAct: false, reason: "Session missing user context. Please log in again." };
    }

    try {
      const steps = await api.approvalSteps(expenseId);
      const pendingSteps = (steps || [])
        .filter((step) => step.status === "pending")
        .sort((a, b) => Number(a.sequence_order) - Number(b.sequence_order));

      if (pendingSteps.length === 0) {
        return { canAct: false, reason: "This expense has no pending approval step." };
      }

      const currentPendingStep = pendingSteps[0];
      if (Number(currentPendingStep.approver_id) !== currentUserId) {
        return { canAct: false, reason: "Waiting for another approver before your step." };
      }

      const hasPendingStepForCurrentUser = pendingSteps.some(
        (step) => Number(step.approver_id) === currentUserId,
      );

      if (!hasPendingStepForCurrentUser) {
        return { canAct: false, reason: "Waiting for another approver on this expense." };
      }

      return { canAct: true, reason: "" };
    } catch {
      // If pre-check fails, allow attempt and rely on backend rule checks.
      return { canAct: true, reason: "" };
    }
  };

  const submitSingleDecision = async (id, action) => {
    const eligibility = await canCurrentUserActOnExpense(id);
    if (!eligibility.canAct) {
      toast.info(eligibility.reason);
      return;
    }

    const comment = (inlineComments[id] || "").trim();
    try {
      await decisionMutation.mutateAsync({ id, action, comment });
      clearCommentsForIds([id]);
      clearSelectionForIds([id]);
      toast.success(
        action === "approve"
          ? "Approval successful: expense marked as approved."
          : "Rejection successful: expense marked as rejected.",
      );
    } catch (err) {
      toast.error(
        action === "approve"
          ? `Approval failed: ${err.message}`
          : `Rejection failed: ${err.message}`,
      );
    } finally {
      qc.invalidateQueries({ queryKey: ["team-expenses"] });
    }
  };

  const submitBulkDecision = async (action) => {
    if (!hasAnySelection) {
      toast.info("Select at least one pending expense to continue.");
      return;
    }

    setBulkActionInFlight(action);

    const eligibilityChecks = await Promise.all(
      selectedPendingIds.map(async (id) => ({
        id,
        eligibility: await canCurrentUserActOnExpense(id),
      })),
    );

    const skippedIds = eligibilityChecks
      .filter((item) => !item.eligibility.canAct)
      .map((item) => item.id);
    const idsToProcess = eligibilityChecks
      .filter((item) => item.eligibility.canAct)
      .map((item) => item.id);

    if (idsToProcess.length === 0) {
      setBulkActionInFlight(null);
      toast.info("No selected expenses are actionable right now. They are waiting on another approver or already finalized.");
      return;
    }

    const outcomes = await Promise.allSettled(
      idsToProcess.map((id) =>
        decisionMutation.mutateAsync({
          id,
          action,
          comment: (inlineComments[id] || "").trim(),
        }),
      ),
    );

    const successCount = outcomes.filter((result) => result.status === "fulfilled").length;
    const failureCount = outcomes.length - successCount;

    if (successCount > 0) {
      const successIds = idsToProcess.filter((_, index) => outcomes[index].status === "fulfilled");
      clearCommentsForIds(successIds);
      clearSelectionForIds(successIds);
    }

    if (failureCount === 0) {
      toast.success(
        action === "approve"
          ? `Approved ${successCount} expense${successCount === 1 ? "" : "s"}${skippedIds.length ? `, skipped ${skippedIds.length}` : ""}.`
          : `Rejected ${successCount} expense${successCount === 1 ? "" : "s"}${skippedIds.length ? `, skipped ${skippedIds.length}` : ""}.`,
      );
    } else if (successCount === 0) {
      toast.error(
        action === "approve"
          ? "Bulk approve failed. Please retry."
          : "Bulk reject failed. Please retry.",
      );
    } else {
      toast.info(
        `${successCount} succeeded, ${failureCount} failed${skippedIds.length ? `, ${skippedIds.length} skipped` : ""}. You can retry failed items.`,
      );
    }

    setBulkActionInFlight(null);
    qc.invalidateQueries({ queryKey: ["team-expenses"] });
  };

  const pendingCount = filteredSorted.filter((item) => item.status === "pending").length;
  const resolvedCount = filteredSorted.filter((item) => item.status !== "pending" && item.status !== "draft").length;

  const updatePresetStorage = (nextPresets) => {
    setSavedPresets(nextPresets);
    localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(nextPresets));
  };

  const savePreset = () => {
    const name = presetName.trim();
    if (!name) {
      toast.error("Enter a preset name before saving");
      return;
    }
    const nextPresets = [
      ...savedPresets.filter((item) => item.name !== name),
      { name, filters },
    ];
    updatePresetStorage(nextPresets);
    setActivePreset(name);
    setPresetName("");
    toast.success(`Preset "${name}" saved`);
  };

  const applyPreset = (name) => {
    setActivePreset(name);
    if (name === "") {
      setFilters(defaultFilters);
      return;
    }
    const preset = savedPresets.find((item) => item.name === name);
    if (!preset) return;
    setFilters({ ...defaultFilters, ...preset.filters });
  };

  const deleteActivePreset = () => {
    if (!activePreset) return;
    const nextPresets = savedPresets.filter((item) => item.name !== activePreset);
    updatePresetStorage(nextPresets);
    setActivePreset("");
    toast.success("Preset deleted");
  };

  const setSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  const sortIndicator = (key) => {
    if (sortConfig.key !== key) return "";
    return sortConfig.direction === "asc" ? " ▲" : " ▼";
  };

  return (
    <AppShell>
      <div style={{ marginBottom: "1.5rem" }}>
        <h2 className="font-display" style={{ fontSize: "1.5rem" }}>Approvals to Review</h2>
        <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginTop: "0.2rem" }}>
          {pendingCount} pending approval{pendingCount !== 1 ? "s" : ""} · {resolvedCount} resolved · {filteredSorted.length} shown
        </p>
      </div>

      <div className="card" style={{ padding: "1rem", marginBottom: "1rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
          <Input
            label="Search"
            placeholder="Search by subject, user, category, status, amount..."
            value={filters.search}
            onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
          />
          <Select
            label="Status"
            value={filters.status}
            onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
          >
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status === "all" ? "All statuses" : status}
              </option>
            ))}
          </Select>
          <Select
            label="Category"
            value={filters.category}
            onChange={(e) => setFilters((prev) => ({ ...prev, category: e.target.value }))}
          >
            {categoryOptions.map((category) => (
              <option key={category} value={category}>
                {category === "all" ? "All categories" : category}
              </option>
            ))}
          </Select>
          <Select
            label="User"
            value={filters.userId}
            onChange={(e) => setFilters((prev) => ({ ...prev, userId: e.target.value }))}
          >
            {userOptions.map((user) => (
              <option key={user.id} value={user.id}>{user.label}</option>
            ))}
          </Select>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto auto", gap: "0.75rem", alignItems: "end" }}>
          <Select
            label="Date Range"
            value={filters.dateRange}
            onChange={(e) => setFilters((prev) => ({ ...prev, dateRange: e.target.value }))}
          >
            <option value="all">All dates</option>
            <option value="last7">Last 7 days</option>
            <option value="last30">Last 30 days</option>
            <option value="thisMonth">This month</option>
            <option value="custom">Custom</option>
          </Select>
          <Input
            label="From"
            type="date"
            disabled={filters.dateRange !== "custom"}
            value={filters.fromDate}
            onChange={(e) => setFilters((prev) => ({ ...prev, fromDate: e.target.value }))}
          />
          <Input
            label="To"
            type="date"
            disabled={filters.dateRange !== "custom"}
            value={filters.toDate}
            onChange={(e) => setFilters((prev) => ({ ...prev, toDate: e.target.value }))}
          />
          <Button onClick={() => { setFilters(defaultFilters); setActivePreset(""); }}>
            Reset Filters
          </Button>
          <Button variant="ghost" onClick={() => setSortConfig({ key: "expense_date", direction: "desc" })}>
            Reset Sort
          </Button>
        </div>
      </div>

      <div className="card" style={{ padding: "1rem", marginBottom: "1.5rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto auto", gap: "0.75rem", alignItems: "end" }}>
          <Input
            label="Save Current Filters As"
            placeholder="e.g., Pending Travel This Month"
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
          />
          <Select
            label="Saved Presets"
            value={activePreset}
            onChange={(e) => applyPreset(e.target.value)}
          >
            <option value="">None</option>
            {savedPresets.map((preset) => (
              <option key={preset.name} value={preset.name}>{preset.name}</option>
            ))}
          </Select>
          <Button variant="primary" onClick={savePreset}>Save Preset</Button>
          <Button variant="danger" onClick={deleteActivePreset} disabled={!activePreset}>Delete Preset</Button>
        </div>
      </div>

      <div className="card" style={{ overflow: "hidden", marginBottom: "1.5rem" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "0.75rem",
            padding: "0.85rem 1rem",
            borderBottom: "1px solid var(--border-color)",
            background: "rgba(255, 255, 255, 0.04)",
          }}
        >
          <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
            {hasAnySelection
              ? `${selectedPendingIds.length} pending expense${selectedPendingIds.length === 1 ? "" : "s"} selected`
              : "Select pending rows to apply bulk decisions"}
          </span>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <Button
              size="sm"
              variant="success"
              disabled={!hasAnySelection || bulkActionInFlight !== null}
              onClick={() => submitBulkDecision("approve")}
            >
              <CheckCircle size={13} />
              {bulkActionInFlight === "approve" ? "Approving..." : "Bulk Approve"}
            </Button>
            <Button
              size="sm"
              variant="danger"
              disabled={!hasAnySelection || bulkActionInFlight !== null}
              onClick={() => submitBulkDecision("reject")}
            >
              <XCircle size={13} />
              {bulkActionInFlight === "reject" ? "Rejecting..." : "Bulk Reject"}
            </Button>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th style={{ width: "42px" }}>
                <Checkbox
                  aria-label="Select all pending visible expenses"
                  checked={areAllPendingVisibleSelected}
                  onChange={(e) => toggleSelectAllPendingVisible(e.target.checked)}
                  disabled={pendingVisibleIds.length === 0}
                />
              </th>
              <th style={{ cursor: "pointer" }} onClick={() => setSort("description")}>Subject{sortIndicator("description")}</th>
              <th style={{ cursor: "pointer" }} onClick={() => setSort("user_name")}>Request Owner{sortIndicator("user_name")}</th>
              <th style={{ cursor: "pointer" }} onClick={() => setSort("category")}>Category{sortIndicator("category")}</th>
              <th style={{ cursor: "pointer" }} onClick={() => setSort("expense_date")}>Date{sortIndicator("expense_date")}</th>
              <th style={{ cursor: "pointer" }} onClick={() => setSort("status")}>Status{sortIndicator("status")}</th>
              <th style={{ cursor: "pointer" }} onClick={() => setSort("amount")}>Amount (Company Currency){sortIndicator("amount")}</th>
              <th style={{ width: "220px" }}>Inline Comment</th>
              <th style={{ width: "220px" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredSorted.length === 0 ? (
              <tr><td colSpan={9} className="empty-state">No expenses match the current filters.</td></tr>
            ) : (
              filteredSorted.map((item) => (
                <tr key={item.id} style={{ opacity: item.status === "pending" ? 1 : 0.75 }}>
                  <td>
                    {item.status === "pending" ? (
                      <Checkbox
                        aria-label={`Select expense ${item.id}`}
                        checked={selectedRows.has(item.id)}
                        onChange={(e) => setRowSelected(item.id, e.target.checked)}
                      />
                    ) : null}
                  </td>
                  <td style={{ fontWeight: 600 }}>{item.description}</td>
                  <td style={{ color: "var(--text-secondary)" }}>{item.user_name || `User #${item.user_id}`}</td>
                  <td>{item.category}</td>
                  <td style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>
                    {new Date(item.expense_date).toLocaleDateString()}
                  </td>
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
                    {item.status === "pending" ? (
                      <Input
                        placeholder="Optional decision comment"
                        value={inlineComments[item.id] || ""}
                        onChange={(e) =>
                          setInlineComments((prev) => ({
                            ...prev,
                            [item.id]: e.target.value,
                          }))
                        }
                      />
                    ) : (
                      <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>Closed</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "0.35rem" }}>
                      <Button size="xs" onClick={() => loadDetail(item)}>
                        <Eye size={11} />
                      </Button>
                      {item.status === "pending" ? (
                        <>
                          <Button
                            size="xs"
                            variant="success"
                            onClick={() => submitSingleDecision(item.id, "approve")}
                            disabled={bulkActionInFlight !== null}
                          >
                            <CheckCircle size={11} /> Approve
                          </Button>
                          <Button
                            size="xs"
                            variant="danger"
                            onClick={() => submitSingleDecision(item.id, "reject")}
                            disabled={bulkActionInFlight !== null}
                          >
                            <XCircle size={11} /> Reject
                          </Button>
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
          </div>
        )}
      </Modal>
    </AppShell>
  );
}
