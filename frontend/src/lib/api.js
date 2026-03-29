const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

function withAuth(headers = {}) {
  const token = localStorage.getItem("rms_access_token");
  return token ? { ...headers, Authorization: `Bearer ${token}` } : headers;
}

async function refreshAccessToken() {
  const refreshToken = localStorage.getItem("rms_refresh_token");
  if (!refreshToken) {
    throw new Error("No refresh token");
  }

  const response = await fetch(`${API_BASE}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!response.ok) {
    throw new Error("Session expired");
  }

  const data = await response.json();
  localStorage.setItem("rms_access_token", data.access_token);
  localStorage.setItem("rms_refresh_token", data.refresh_token);
  if (data.role) localStorage.setItem("rms_role", data.role);
  if (data.user_name) localStorage.setItem("rms_user_name", data.user_name);
  if (data.user_id) localStorage.setItem("rms_user_id", String(data.user_id));
  return data;
}

async function request(path, options = {}, retried = false) {
  const isFormData = options.body instanceof FormData;
  const headers = isFormData
    ? withAuth(options.headers)
    : { "Content-Type": "application/json", ...withAuth(options.headers) };

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401 && !retried && !path.startsWith("/auth/")) {
    try {
      await refreshAccessToken();
      return request(path, options, true);
    } catch {
      ["rms_access_token", "rms_refresh_token", "rms_role", "rms_user_name", "rms_user_id"].forEach(
        (k) => localStorage.removeItem(k)
      );
    }
  }

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
  refresh: (refresh_token) => request("/auth/refresh", { method: "POST", body: JSON.stringify({ refresh_token }) }),
  logout: (refresh_token) => request("/auth/logout", { method: "POST", body: JSON.stringify({ refresh_token }) }),
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

  // Expenses
  createExpense: (payload) => request("/expenses", { method: "POST", body: JSON.stringify(payload) }),
  updateExpense: (id, payload) => request(`/expenses/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  submitExpense: (id) => request(`/expenses/${id}/submit`, { method: "POST" }),
  myExpenses: () => request("/expenses/my"),
  teamExpenses: () => request("/expenses/team"),
  getExpenseDetail: (id) => request(`/expenses/${id}`),
  getExpenseTimeline: (id) => request(`/expenses/${id}/timeline`),
  auditStream: (limit = 100) => request(`/audit/stream?limit=${limit}`),
  uploadReceipt: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return request("/expenses/upload-receipt", { method: "POST", body: formData });
  },

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
};
