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
import { UserPlus, Key, Send } from "lucide-react";

export function AdminPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "", role: "employee", manager_id: "" });
  const [pwModal, setPwModal] = useState(null);

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
      toast.success("Password generated");
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
        <Button variant="primary" onClick={() => setShowForm(!showForm)}>
          <UserPlus size={15} />
          {showForm ? "Cancel" : "New User"}
        </Button>
      </div>

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
                      <Button
                        size="xs"
                        onClick={() => sendPwMutation.mutate(u.id)}
                        title="Generate & share temporary password"
                      >
                        <Key size={12} />
                        Send Password
                      </Button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

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
