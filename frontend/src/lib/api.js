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
  approvalLogs: (expenseId) => request(`/approvals/${expenseId}/logs`),
  approvalSteps: (expenseId) => request(`/approvals/${expenseId}/steps`),
};
