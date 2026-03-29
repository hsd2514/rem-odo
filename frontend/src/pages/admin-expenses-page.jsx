import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "../components/layout/app-shell";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Modal } from "../components/ui/modal";
import { api } from "../lib/api";
import { FileText } from "lucide-react";

const defaultFilters = {
  search: "",
  status: "all",
  userId: "all",
};

export function AdminExpensesPage() {
  const [filters, setFilters] = useState(defaultFilters);
  const [selectedExpense, setSelectedExpense] = useState(null);

  const expensesQuery = useQuery({ queryKey: ["company-expenses"], queryFn: api.companyExpenses });

  const expenses = expensesQuery.data || [];

  const statusOptions = useMemo(() => {
    const statuses = new Set(expenses.map((item) => item.status).filter(Boolean));
    return ["all", ...Array.from(statuses)];
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
    return [{ id: "all", label: "All users" }, ...Array.from(unique.values())];
  }, [expenses]);

  const filtered = useMemo(() => {
    const query = filters.search.trim().toLowerCase();
    return expenses.filter((item) => {
      if (filters.status !== "all" && item.status !== filters.status) return false;
      if (filters.userId !== "all" && String(item.user_id) !== filters.userId) return false;
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
  }, [expenses, filters]);

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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h2 className="font-display" style={{ fontSize: "1.5rem" }}>All Company Expenses</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginTop: "0.2rem" }}>
            Admin-level view across all employees
          </p>
        </div>
      </div>

      <div className="card" style={{ padding: "1rem", marginBottom: "1.5rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "0.75rem" }}>
          <Input
            label="Search"
            placeholder="User, category, amount, status..."
            value={filters.search}
            onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))}
          />
          <Select
            label="Status"
            value={filters.status}
            onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}
          >
            {statusOptions.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </Select>
          <Select
            label="User"
            value={filters.userId}
            onChange={(e) => setFilters((p) => ({ ...p, userId: e.target.value }))}
          >
            {userOptions.map((user) => (
              <option key={user.id} value={user.id}>{user.label}</option>
            ))}
          </Select>
        </div>
      </div>

      <div className="card" style={{ overflow: "hidden" }}>
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th>Employee</th>
              <th>Category</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="empty-state">No expenses found for this view.</td>
              </tr>
            ) : (
              filtered.map((item) => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 600 }}>{item.description}</td>
                  <td style={{ color: "var(--text-secondary)", fontSize: "0.82rem" }}>
                    {item.user_name || `User #${item.user_id}`}
                  </td>
                  <td>{item.category}</td>
                  <td style={{ fontWeight: 600 }}>
                    {item.amount} <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{item.currency}</span>
                  </td>
                  <td><Badge status={item.status}>{item.status}</Badge></td>
                  <td>
                    <Button size="xs" onClick={() => loadDetail(item)}>
                      <FileText size={11} /> View
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={!!selectedExpense}
        onClose={() => setSelectedExpense(null)}
        title={`Expense: ${selectedExpense?.expense?.description || ""}`}
      >
        {selectedExpense && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1.5rem" }}>
              {[
                ["Employee", selectedExpense.expense.user_name || `User #${selectedExpense.expense.user_id}`],
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
          </div>
        )}
      </Modal>
    </AppShell>
  );
}
