import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useToast } from "../context/toast-context";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { AppShell } from "../components/layout/app-shell";
import { Badge } from "../components/ui/badge";
import { Modal } from "../components/ui/modal";
import { UserPlus, Key, RefreshCcw, DatabaseZap } from "lucide-react";

export function AdminPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "", role: "employee", manager_id: "" });
  const [pwModal, setPwModal] = useState(null);
  const [bootstrapSummary, setBootstrapSummary] = useState(null);
  const [editUser, setEditUser] = useState(null);
  const [editPayload, setEditPayload] = useState({ role: "employee", manager_id: "" });

  const usersQuery = useQuery({ queryKey: ["users"], queryFn: api.users });

  const userMutation = useMutation({
    mutationFn: api.createUser,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success("User created successfully");
      setNewUser({ name: "", email: "", role: "employee", manager_id: "" });
      setShowForm(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const sendPwMutation = useMutation({
    mutationFn: (userId) => api.sendPassword(userId),
    onSuccess: (data) => {
      setPwModal(data);
      toast.success("Temporary password generated and ready to share.", { key: "password-sent-success" });
    },
    onError: (err) => toast.error(`Password generation failed: ${err.message}`, { key: "password-sent-error" }),
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, payload }) => api.updateUser(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success("User updated successfully");
      setEditUser(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const seedDemoMutation = useMutation({
    mutationFn: api.loadSampleData,
    onSuccess: (data) => {
      qc.invalidateQueries();
      const managerCount = data?.users?.manager ?? 0;
      const employeeCount = data?.users?.employee ?? 0;
      const totalExpenses = Object.values(data?.expenses || {}).reduce((sum, count) => sum + Number(count || 0), 0);
      setBootstrapSummary(data);
      toast.success(`Environment loaded: ${managerCount} managers, ${employeeCount} employees, ${totalExpenses} expenses`);
    },
    onError: (err) => toast.error(err.message),
  });

  const resetDemoMutation = useMutation({
    mutationFn: api.resetCompanyData,
    onSuccess: () => {
      qc.invalidateQueries();
      setBootstrapSummary(null);
      toast.success("Environment reset to clean state");
    },
    onError: (err) => toast.error(err.message),
  });

  const managerOptions = useMemo(
    () => (usersQuery.data || []).filter((item) => item.role === "manager" || item.role === "admin"),
    [usersQuery.data]
  );

  const users = usersQuery.data || [];

  return (
    <AppShell>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h2 className="font-display" style={{ fontSize: "1.5rem" }}>User Management</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginTop: "0.2rem" }}>
            {users.length} user{users.length !== 1 ? "s" : ""} in your organization
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Button
            variant="success"
            onClick={() => {
              seedDemoMutation.mutate();
            }}
            disabled={seedDemoMutation.isPending || resetDemoMutation.isPending}
            title="Load realistic sample company/users/expenses/workflows data"
          >
            <DatabaseZap size={14} />
            {seedDemoMutation.isPending ? "Loading Environment..." : "Load Sample Data"}
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              const confirmed = window.confirm("Reset all users/expenses/workflows for this company (except your admin account)?");
              if (confirmed) resetDemoMutation.mutate();
            }}
            disabled={seedDemoMutation.isPending || resetDemoMutation.isPending}
            title="Reset to clean state"
          >
            <RefreshCcw size={14} />
            {resetDemoMutation.isPending ? "Resetting..." : "Reset Environment"}
          </Button>
          <Button variant="primary" onClick={() => setShowForm(!showForm)}>
            <UserPlus size={15} />
            {showForm ? "Cancel" : "New User"}
          </Button>
        </div>
      </div>

      {bootstrapSummary && (
        <div className="card" style={{ padding: "1rem", marginBottom: "1.5rem", borderColor: "rgba(52, 211, 153, 0.35)" }}>
          <h3 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: "0.75rem" }}>Environment Ready</h3>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.82rem", marginBottom: "0.75rem" }}>
            Sample organization, users, workflows, and mixed-status expenses have been loaded for judging.
          </p>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <Badge status="approved">Managers: {bootstrapSummary?.users?.manager ?? 0}</Badge>
            <Badge status="approved">Employees: {bootstrapSummary?.users?.employee ?? 0}</Badge>
            <Badge status="pending">Pending: {bootstrapSummary?.expenses?.pending ?? 0}</Badge>
            <Badge status="approved">Approved: {bootstrapSummary?.expenses?.approved ?? 0}</Badge>
            <Badge status="rejected">Rejected: {bootstrapSummary?.expenses?.rejected ?? 0}</Badge>
          </div>
          {(bootstrapSummary?.credentials || []).length > 0 && (
            <div style={{ marginTop: "0.9rem" }}>
              <p style={{ color: "var(--text-muted)", fontSize: "0.75rem", marginBottom: "0.4rem" }}>
                Sample sign-in credentials:
              </p>
              <div style={{ background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "0.75rem" }}>
                {(bootstrapSummary.credentials || []).map((item) => (
                  <div key={item.email} style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.25rem" }}>
                    <strong>{item.role}</strong>: {item.email} / {item.password}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create User Form */}
      {showForm && (
        <div className="card" style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
          <h3 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: "1rem" }}>Create New User</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "0.75rem", alignItems: "end" }}>
            <Input label="Name" placeholder="John Smith" value={newUser.name} onChange={(e) => setNewUser((p) => ({ ...p, name: e.target.value }))} />
            <Input label="Email" placeholder="john@company.com" value={newUser.email} onChange={(e) => setNewUser((p) => ({ ...p, email: e.target.value }))} />
            <Select label="Role" value={newUser.role} onChange={(e) => setNewUser((p) => ({ ...p, role: e.target.value }))}>
              <option value="employee">Employee</option>
              <option value="manager">Manager</option>
            </Select>
            <Select label="Manager" value={newUser.manager_id} onChange={(e) => setNewUser((p) => ({ ...p, manager_id: e.target.value }))}>
              <option value="">No Manager</option>
              {managerOptions.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </Select>
          </div>
          <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem" }}>
            <Button variant="primary" onClick={() => userMutation.mutate({
              name: newUser.name,
              email: newUser.email,
              role: newUser.role,
              manager_id: newUser.manager_id ? Number(newUser.manager_id) : null,
            })}>
              {userMutation.isPending ? "Creating..." : "Create User"}
            </Button>
            <Button onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="card" style={{ overflow: "hidden" }}>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Manager</th>
              <th style={{ width: "140px" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr><td colSpan={5} className="empty-state">No users yet. Create your first employee or manager.</td></tr>
            ) : (
              users.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 600 }}>{u.name}</td>
                  <td style={{ color: "var(--text-secondary)" }}>{u.email}</td>
                  <td>
                    <Badge status={u.role === "admin" ? "approved" : u.role === "manager" ? "pending" : "draft"}>
                      {u.role}
                    </Badge>
                  </td>
                  <td style={{ color: "var(--text-secondary)" }}>{u.manager_name || "—"}</td>
                  <td>
                    {u.role !== "admin" && (
                      <div style={{ display: "flex", gap: "0.35rem" }}>
                        <Button
                          size="xs"
                          onClick={() => {
                            setEditUser(u);
                            setEditPayload({
                              role: u.role,
                              manager_id: u.manager_id ? String(u.manager_id) : "",
                            });
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          size="xs"
                          onClick={() => sendPwMutation.mutate(u.id)}
                          title="Generate & share temporary password"
                        >
                          <Key size={12} />
                          Send Password
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Edit User Modal */}
      <Modal open={!!editUser} onClose={() => setEditUser(null)} title="Edit User">
        {editUser && (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            <div>
              <span className="label">User</span>
              <p style={{ margin: 0, fontWeight: 600 }}>{editUser.name} ({editUser.email})</p>
            </div>
            <Select
              label="Role"
              value={editPayload.role}
              onChange={(e) => setEditPayload((p) => ({ ...p, role: e.target.value }))}
            >
              <option value="employee">Employee</option>
              <option value="manager">Manager</option>
            </Select>
            <Select
              label="Manager"
              value={editPayload.manager_id}
              onChange={(e) => setEditPayload((p) => ({ ...p, manager_id: e.target.value }))}
            >
              <option value="">No Manager</option>
              {managerOptions.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </Select>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <Button
                variant="primary"
                onClick={() => updateUserMutation.mutate({
                  id: editUser.id,
                  payload: {
                    role: editPayload.role,
                    manager_id: editPayload.manager_id ? Number(editPayload.manager_id) : null,
                  },
                })}
              >
                {updateUserMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
              <Button onClick={() => setEditUser(null)}>Cancel</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Password Modal */}
      <Modal open={!!pwModal} onClose={() => setPwModal(null)} title="Generated Password">
        {pwModal && (
          <div>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginBottom: "1rem" }}>{pwModal.message}</p>
            <div style={{ background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "1rem", fontFamily: "monospace", fontSize: "1.1rem", textAlign: "center", letterSpacing: "0.1em", color: "var(--accent)" }}>
              {pwModal.password}
            </div>
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.75rem" }}>
              Share this password securely. The user will need to change it after first login.
            </p>
          </div>
        )}
      </Modal>
    </AppShell>
  );
}
