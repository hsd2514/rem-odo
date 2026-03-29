const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

function withAuth(headers = {}) {
  const token = localStorage.getItem("rms_access_token");
  return token ? { ...headers, Authorization: `Bearer ${token}` } : headers;
}

async function request(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const headers = isFormData
    ? withAuth(options.headers)
    : { "Content-Type": "application/json", ...withAuth(options.headers) };

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let detail;
    try {
      const json = await response.json();
      detail = json.detail || JSON.stringify(json);
    } catch {
      detail = await response.text();
    }
    throw new Error(detail || "Request failed");
  }

  if (response.status === 204) return null;
  return response.json();
}

export const api = {
  // Auth
  signup: (payload) => request("/auth/signup", { method: "POST", body: JSON.stringify(payload) }),
  login: (payload) => request("/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  logout: (refreshToken) =>
    request("/auth/logout", { method: "POST", body: JSON.stringify({ refresh_token: refreshToken }) }),
  refresh: (refreshToken) =>
    request("/auth/refresh", { method: "POST", body: JSON.stringify({ refresh_token: refreshToken }) }),
  getMe: () => request("/auth/me"),
  getCountries: () => request("/auth/countries"),

  // Users
  users: () => request("/users"),
  createUser: (payload) => request("/users", { method: "POST", body: JSON.stringify(payload) }),
  sendPassword: (userId) => request(`/users/${userId}/send-password`, { method: "POST" }),

  // Workflow
  createWorkflow: (payload) => request("/workflow/create", { method: "POST", body: JSON.stringify(payload) }),
  updateWorkflow: (payload) => request("/workflow/update", { method: "PATCH", body: JSON.stringify(payload) }),
  getWorkflow: (userId) => request(`/workflow/${userId}`),

  // Environment bootstrap
  loadSampleData: () => request("/bootstrap/load-sample-data", { method: "POST" }),
  resetCompanyData: () => request("/bootstrap/reset-company-data", { method: "POST" }),
  // Backward-compatible aliases
  seedDemo: () => request("/bootstrap/load-sample-data", { method: "POST" }),
  resetDemo: () => request("/bootstrap/reset-company-data", { method: "POST" }),

  // Expenses
  createExpense: (payload) => request("/expenses", { method: "POST", body: JSON.stringify(payload) }),
  updateExpense: (id, payload) => request(`/expenses/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  submitExpense: (id) => request(`/expenses/${id}/submit`, { method: "POST" }),
  myExpenses: () => request("/expenses/my"),
  teamExpenses: () => request("/expenses/team"),
  getExpenseDetail: (id) => request(`/expenses/${id}`),
  getExpenseTimeline: (id) => request(`/expenses/${id}/timeline`),
  uploadReceipt: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return request("/expenses/upload-receipt", { method: "POST", body: formData });
  },
  attachReceipt: (expenseId, receiptId) =>
    request(`/expenses/${expenseId}/attach-receipt?receipt_id=${receiptId}`, { method: "POST" }),

  // Approvals
  approve: (expenseId, comment = "") =>
    request(`/approvals/${expenseId}/approve`, { method: "POST", body: JSON.stringify({ comment }) }),
  reject: (expenseId, comment = "") =>
    request(`/approvals/${expenseId}/reject`, { method: "POST", body: JSON.stringify({ comment }) }),
  overrideApprove: (expenseId, comment = "") =>
    request(`/approvals/${expenseId}/override-approve`, { method: "POST", body: JSON.stringify({ comment }) }),
  overrideReject: (expenseId, comment = "") =>
    request(`/approvals/${expenseId}/override-reject`, { method: "POST", body: JSON.stringify({ comment }) }),
  approvalLogs: (expenseId) => request(`/approvals/${expenseId}/logs`),
  approvalSteps: (expenseId) => request(`/approvals/${expenseId}/steps`),

  // Analytics
  analyticsSummary: (filters = {}) => request(`/analytics/summary${buildQuery(filters)}`),
  analyticsMonthly: (filters = {}) => request(`/analytics/monthly-spend${buildQuery(filters)}`),
  analyticsCategory: (filters = {}) => request(`/analytics/category-breakdown${buildQuery(filters)}`),
  analyticsTeam: (filters = {}) => request(`/analytics/team-breakdown${buildQuery(filters)}`),
};

function buildQuery(filters) {
  const params = new URLSearchParams();
  if (filters.month) params.set("month", filters.month);
  if (filters.category) params.set("category", filters.category);
  if (filters.user_id) params.set("user_id", String(filters.user_id));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}
