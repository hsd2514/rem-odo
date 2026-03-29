import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { AppShell } from "../components/layout/app-shell";
import { Badge } from "../components/ui/badge";
import {
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  DollarSign,
  Filter,
  X,
} from "lucide-react";

const FMT = (n, currency = "INR") =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);

export function AnalyticsPage() {
  const [filters, setFilters] = useState({});

  const summaryQ = useQuery({
    queryKey: ["analytics-summary", filters],
    queryFn: () => api.analyticsSummary(filters),
  });
  const monthlyQ = useQuery({
    queryKey: ["analytics-monthly", filters],
    queryFn: () => api.analyticsMonthly(filters),
  });
  const categoryQ = useQuery({
    queryKey: ["analytics-category", filters],
    queryFn: () => api.analyticsCategory(filters),
  });
  const teamQ = useQuery({
    queryKey: ["analytics-team", filters],
    queryFn: () => api.analyticsTeam(filters),
  });

  const summary = summaryQ.data || {};
  const monthly = monthlyQ.data || [];
  const categories = categoryQ.data || [];
  const team = teamQ.data || [];

  // Build filter option lists from data
  const categoryOptions = useMemo(() => {
    return [...new Set((categoryQ.data || []).map((c) => c.category))].sort();
  }, [categoryQ.data]);

  const monthOptions = useMemo(() => {
    const now = new Date();
    const opts = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleString("en-US", { month: "short", year: "numeric" });
      opts.push({ value: val, label });
    }
    return opts;
  }, []);

  const setFilter = (key, value) =>
    setFilters((prev) => {
      const next = { ...prev };
      if (!value) delete next[key];
      else next[key] = value;
      return next;
    });

  const hasFilters = Object.keys(filters).length > 0;

  const maxMonthly = useMemo(
    () => Math.max(1, ...monthly.map((m) => m.total)),
    [monthly]
  );

  const isLoading = summaryQ.isLoading;

  return (
    <AppShell>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.25rem",
        }}
      >
        <div>
          <h2 className="font-display" style={{ fontSize: "1.5rem" }}>
            Analytics Dashboard
          </h2>
          <p
            style={{
              color: "var(--text-muted)",
              fontSize: "0.8rem",
              marginTop: "0.2rem",
            }}
          >
            Company-wide expense insights &amp; KPIs
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="dash-filter-bar" id="analytics-filters">
        <Filter size={15} style={{ color: "var(--text-muted)", flexShrink: 0 }} />

        <div className="filter-group">
          <span className="label">Month</span>
          <select
            className="select"
            value={filters.month || ""}
            onChange={(e) => setFilter("month", e.target.value)}
          >
            <option value="">All Months</option>
            {monthOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <span className="label">Category</span>
          <select
            className="select"
            value={filters.category || ""}
            onChange={(e) => setFilter("category", e.target.value)}
          >
            <option value="">All Categories</option>
            {categoryOptions.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <span className="label">Team Member</span>
          <select
            className="select"
            value={filters.user_id || ""}
            onChange={(e) => setFilter("user_id", e.target.value)}
          >
            <option value="">All Members</option>
            {team.map((t) => (
              <option key={t.user_id} value={t.user_id}>
                {t.user_name}
              </option>
            ))}
          </select>
        </div>

        {hasFilters && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setFilters({})}
            style={{ marginLeft: "auto" }}
          >
            <X size={14} />
            Clear
          </button>
        )}
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="empty-state">Loading analytics…</div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="kpi-grid" id="analytics-kpis">
            <div className="kpi-card">
              <span className="kpi-label">Total Spend</span>
              <span className="kpi-value">{FMT(summary.total_spend || 0)}</span>
              <span className="kpi-sub">
                {summary.total_count || 0} expense{summary.total_count !== 1 ? "s" : ""}
              </span>
              <TrendingUp
                size={18}
                style={{
                  position: "absolute",
                  top: "1.25rem",
                  right: "1.25rem",
                  color: "var(--text-muted)",
                  opacity: 0.5,
                }}
              />
            </div>

            <div className="kpi-card accent-pending">
              <span className="kpi-label">Pending</span>
              <span className="kpi-value">{summary.pending_count || 0}</span>
              <span className="kpi-sub">{FMT(summary.pending_amount || 0)}</span>
              <Clock
                size={18}
                style={{
                  position: "absolute",
                  top: "1.25rem",
                  right: "1.25rem",
                  color: "var(--warning)",
                  opacity: 0.5,
                }}
              />
            </div>

            <div className="kpi-card accent-approved">
              <span className="kpi-label">Approved</span>
              <span className="kpi-value">{summary.approved_count || 0}</span>
              <span className="kpi-sub">{FMT(summary.approved_amount || 0)}</span>
              <CheckCircle
                size={18}
                style={{
                  position: "absolute",
                  top: "1.25rem",
                  right: "1.25rem",
                  color: "var(--success)",
                  opacity: 0.5,
                }}
              />
            </div>

            <div className="kpi-card accent-rejected">
              <span className="kpi-label">Rejected</span>
              <span className="kpi-value">{summary.rejected_count || 0}</span>
              <span className="kpi-sub">{FMT(summary.rejected_amount || 0)}</span>
              <XCircle
                size={18}
                style={{
                  position: "absolute",
                  top: "1.25rem",
                  right: "1.25rem",
                  color: "var(--danger)",
                  opacity: 0.5,
                }}
              />
            </div>

            <div className="kpi-card accent-avg">
              <span className="kpi-label">Avg Expense</span>
              <span className="kpi-value">{FMT(summary.avg_expense || 0)}</span>
              <span className="kpi-sub">{summary.draft_count || 0} drafts</span>
              <DollarSign
                size={18}
                style={{
                  position: "absolute",
                  top: "1.25rem",
                  right: "1.25rem",
                  color: "var(--blue)",
                  opacity: 0.5,
                }}
              />
            </div>
          </div>

          {/* Charts Row: Monthly + Category */}
          <div className="dash-charts-row">
            {/* Monthly Spend Bar Chart */}
            <div className="chart-card" id="analytics-monthly-chart">
              <h3 className="chart-title">Monthly Spend Trend</h3>

              {/* Legend */}
              <div
                style={{
                  display: "flex",
                  gap: "1rem",
                  marginBottom: "0.75rem",
                  fontSize: "0.7rem",
                  color: "var(--text-muted)",
                  fontWeight: 600,
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 2,
                      background: "var(--success)",
                      display: "inline-block",
                    }}
                  />{" "}
                  Approved
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 2,
                      background: "var(--warning)",
                      display: "inline-block",
                    }}
                  />{" "}
                  Pending
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 2,
                      background: "var(--danger)",
                      display: "inline-block",
                    }}
                  />{" "}
                  Rejected
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 2,
                      background: "#d1d5db",
                      display: "inline-block",
                    }}
                  />{" "}
                  Draft
                </span>
              </div>

              <div className="bar-chart">
                {monthly.map((m) => {
                  const chartH = 180; // px
                  const totalPx =
                    m.total > 0 ? Math.max((m.total / maxMonthly) * chartH, 4) : 0;
                  const approvedPx =
                    m.approved > 0 && m.total > 0 ? (m.approved / m.total) * totalPx : 0;
                  const pendingPx =
                    m.pending > 0 && m.total > 0 ? (m.pending / m.total) * totalPx : 0;
                  const rejectedPx =
                    m.rejected > 0 && m.total > 0 ? (m.rejected / m.total) * totalPx : 0;
                  const draftPx =
                    (m.draft || 0) > 0 && m.total > 0 ? (m.draft / m.total) * totalPx : 0;

                  return (
                    <div className="bar-group" key={`${m.year}-${m.month}`}>
                      <div className="bar-tooltip">
                        {FMT(m.total)} · {m.count} exp
                      </div>
                      <div className="bar-stack" style={{ height: totalPx }}>
                        <div
                          className="bar-segment draft"
                          style={{ height: draftPx }}
                        />
                        <div
                          className="bar-segment rejected"
                          style={{ height: rejectedPx }}
                        />
                        <div
                          className="bar-segment pending"
                          style={{ height: pendingPx }}
                        />
                        <div
                          className="bar-segment approved"
                          style={{ height: approvedPx }}
                        />
                      </div>
                      <span className="bar-label">{m.month_label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Category Breakdown */}
            <div className="chart-card" id="analytics-category-chart">
              <h3 className="chart-title">By Category</h3>
              {categories.length === 0 ? (
                <p
                  style={{
                    color: "var(--text-muted)",
                    fontSize: "0.82rem",
                    textAlign: "center",
                    padding: "2rem 0",
                  }}
                >
                  No data
                </p>
              ) : (
                <div className="cat-list">
                  {categories.map((cat, i) => (
                    <div className="cat-item" key={cat.category}>
                      <div className="cat-header">
                        <span className="cat-name">{cat.category}</span>
                        <span className="cat-amount">
                          {FMT(cat.total)}{" "}
                          <span className="cat-pct">({cat.percentage}%)</span>
                        </span>
                      </div>
                      <div className="cat-bar-track">
                        <div
                          className={`cat-bar-fill cat-${Math.min(i, 5)}`}
                          style={{ width: `${cat.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Team Breakdown Table */}
          <div className="team-card" id="analytics-team-table">
            <h3 className="chart-title">Team Breakdown</h3>
            {team.length === 0 ? (
              <p
                style={{
                  color: "var(--text-muted)",
                  fontSize: "0.82rem",
                  textAlign: "center",
                  padding: "2rem 0",
                }}
              >
                No team data
              </p>
            ) : (
              <div style={{ overflow: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Role</th>
                      <th style={{ textAlign: "right" }}>Expenses</th>
                      <th style={{ textAlign: "right" }}>Total Spend</th>
                      <th style={{ textAlign: "center" }}>Pending</th>
                      <th style={{ textAlign: "center" }}>Approved</th>
                      <th style={{ textAlign: "center" }}>Rejected</th>
                      <th style={{ width: "160px" }}>Approval Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {team.map((member) => {
                      const total =
                        member.approved_count +
                        member.rejected_count +
                        member.pending_count;
                      const rate =
                        total > 0
                          ? Math.round(
                              (member.approved_count / total) * 100
                            )
                          : 0;
                      const isActive =
                        filters.user_id &&
                        String(filters.user_id) === String(member.user_id);

                      return (
                        <tr
                          key={member.user_id}
                          className={isActive ? "active-row" : ""}
                          onClick={() =>
                            setFilter(
                              "user_id",
                              isActive ? "" : String(member.user_id)
                            )
                          }
                          title="Click to filter by this team member"
                        >
                          <td style={{ fontWeight: 600 }}>{member.user_name}</td>
                          <td>
                            <Badge
                              status={
                                member.role === "admin"
                                  ? "approved"
                                  : member.role === "manager"
                                  ? "pending"
                                  : "draft"
                              }
                            >
                              {member.role}
                            </Badge>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            {member.expense_count}
                          </td>
                          <td
                            style={{
                              textAlign: "right",
                              fontWeight: 600,
                              fontFamily: "var(--font-display)",
                            }}
                          >
                            {FMT(member.total_spend)}
                          </td>
                          <td style={{ textAlign: "center" }}>
                            {member.pending_count > 0 ? (
                              <Badge status="pending">{member.pending_count}</Badge>
                            ) : (
                              <span style={{ color: "var(--text-muted)" }}>—</span>
                            )}
                          </td>
                          <td style={{ textAlign: "center" }}>
                            {member.approved_count > 0 ? (
                              <Badge status="approved">{member.approved_count}</Badge>
                            ) : (
                              <span style={{ color: "var(--text-muted)" }}>—</span>
                            )}
                          </td>
                          <td style={{ textAlign: "center" }}>
                            {member.rejected_count > 0 ? (
                              <Badge status="rejected">{member.rejected_count}</Badge>
                            ) : (
                              <span style={{ color: "var(--text-muted)" }}>—</span>
                            )}
                          </td>
                          <td>
                            <div className="approval-rate-bar">
                              <div className="mini-bar-track">
                                <div
                                  className="mini-bar-fill"
                                  style={{ width: `${rate}%` }}
                                />
                              </div>
                              <span className="mini-bar-label">{rate}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </AppShell>
  );
}
