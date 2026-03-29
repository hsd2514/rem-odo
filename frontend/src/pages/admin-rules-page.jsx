import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useToast } from "../context/toast-context";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Switch } from "../components/ui/switch";
import { Checkbox } from "../components/ui/checkbox";
import { AppShell } from "../components/layout/app-shell";
import { Badge } from "../components/ui/badge";
import { ArrowDown, ArrowUp, GripVertical, Save } from "lucide-react";

export function AdminRulesPage() {
  const toast = useToast();
  const [selectedUser, setSelectedUser] = useState("");
  const [draggedApproverId, setDraggedApproverId] = useState(null);
  const [dragOverApproverId, setDragOverApproverId] = useState(null);
  const [flow, setFlow] = useState({
    description: "",
    manager_first: true,
    sequential: true,
    min_approval_percentage: 60,
    approverIds: [],
    requiredApproverIds: [],
    autoApproveApproverIds: [],
  });

  const usersQuery = useQuery({ queryKey: ["users"], queryFn: api.users });

  const employees = useMemo(
    () => (usersQuery.data || []).filter((u) => u.role === "employee"),
    [usersQuery.data]
  );

  const allApprovers = useMemo(
    () => (usersQuery.data || []).filter((u) => u.role === "manager" || u.role === "admin"),
    [usersQuery.data]
  );

  // Load existing workflow when user selected
  useEffect(() => {
    if (!selectedUser) return;
    api.getWorkflow(selectedUser).then((data) => {
      if (data) {
        setFlow({
          description: data.description,
          manager_first: data.manager_first,
          sequential: data.sequential,
          min_approval_percentage: data.min_approval_percentage,
          approverIds: data.approvers || [],
          requiredApproverIds: data.required_approvers || [],
          autoApproveApproverIds: data.auto_approve_approvers || [],
        });
      } else {
        setFlow({
          description: "Approval rule for miscellaneous expenses",
          manager_first: true,
          sequential: true,
          min_approval_percentage: 60,
          approverIds: [],
          requiredApproverIds: [],
          autoApproveApproverIds: [],
        });
      }
    }).catch(() => {});
  }, [selectedUser]);

  const saveMutation = useMutation({
    mutationFn: (payload) => api.updateWorkflow(payload),
    onSuccess: () => toast.success("Approval rule saved"),
    onError: (err) => toast.error(err.message),
  });

  const toggleApprover = (id) => {
    setFlow((p) => ({
      ...p,
      approverIds: p.approverIds.includes(id)
        ? p.approverIds.filter((x) => x !== id)
        : [...p.approverIds, id],
      requiredApproverIds: p.approverIds.includes(id)
        ? p.requiredApproverIds.filter((x) => x !== id)
        : p.requiredApproverIds,
    }));
  };

  const toggleRequired = (id) => {
    setFlow((p) => ({
      ...p,
      requiredApproverIds: p.requiredApproverIds.includes(id)
        ? p.requiredApproverIds.filter((x) => x !== id)
        : [...p.requiredApproverIds, id],
    }));
  };

  const toggleAutoApprove = (id) => {
    setFlow((p) => ({
      ...p,
      autoApproveApproverIds: p.autoApproveApproverIds.includes(id)
        ? p.autoApproveApproverIds.filter((x) => x !== id)
        : [...p.autoApproveApproverIds, id],
    }));
  };

  const moveApprover = (approverId, direction) => {
    setFlow((prev) => {
      const current = [...prev.approverIds];
      const idx = current.indexOf(approverId);
      if (idx < 0) return prev;
      const nextIdx = direction === "up" ? idx - 1 : idx + 1;
      if (nextIdx < 0 || nextIdx >= current.length) return prev;
      const [moved] = current.splice(idx, 1);
      current.splice(nextIdx, 0, moved);
      return { ...prev, approverIds: current };
    });
  };

  const reorderApprover = (fromId, toId) => {
    if (!fromId || !toId || fromId === toId) return;
    setFlow((prev) => {
      const current = [...prev.approverIds];
      const fromIdx = current.indexOf(fromId);
      const toIdx = current.indexOf(toId);
      if (fromIdx < 0 || toIdx < 0) return prev;
      const [moved] = current.splice(fromIdx, 1);
      current.splice(toIdx, 0, moved);
      return { ...prev, approverIds: current };
    });
  };

  const handleSave = () => {
    if (!selectedUser) {
      toast.error("Select an employee first");
      return;
    }
    if (!flow.sequential && flow.approverIds.length > 1) {
      toast.info("Parallel mode enabled: order is saved but ignored during runtime approvals.");
    }
    saveMutation.mutate({
      user_id: Number(selectedUser),
      description: flow.description,
      manager_first: flow.manager_first,
      sequential: flow.sequential,
      min_approval_percentage: flow.min_approval_percentage,
      approvers: flow.approverIds,
      required_approvers: flow.requiredApproverIds,
      auto_approve_approvers: flow.autoApproveApproverIds,
    });
  };

  const selectedEmployee = employees.find((e) => String(e.id) === selectedUser);
  const selectedApprovers = useMemo(
    () =>
      flow.approverIds
        .map((id) => allApprovers.find((a) => a.id === id))
        .filter(Boolean),
    [allApprovers, flow.approverIds]
  );

  const requiredApprovers = useMemo(
    () => allApprovers.filter((a) => flow.requiredApproverIds.includes(a.id)),
    [allApprovers, flow.requiredApproverIds]
  );

  const autoApproveApprovers = useMemo(
    () => allApprovers.filter((a) => flow.autoApproveApproverIds.includes(a.id)),
    [allApprovers, flow.autoApproveApproverIds]
  );

  const explanation = useMemo(() => {
    if (!selectedEmployee) {
      return ["Select an employee to generate a workflow explanation."];
    }

    if (selectedApprovers.length === 0) {
      return [
        `${selectedEmployee.name} currently has no approvers configured.`,
        "Add at least one approver so the request can move beyond Draft.",
      ];
    }

    const approverNames = selectedApprovers.map((a) => a.name).join(", ");
    const requiredNames = requiredApprovers.length > 0
      ? requiredApprovers.map((a) => a.name).join(", ")
      : "None";
    const autoApproveNames = autoApproveApprovers.length > 0
      ? autoApproveApprovers.map((a) => a.name).join(", ")
      : "None";

    const managerLine = flow.manager_first
      ? `Manager-first is ON, so ${selectedEmployee.manager_name || "the assigned manager"} is prioritized before other approvers when available.`
      : "Manager-first is OFF, so the request starts with your configured approver set directly.";

    const sequenceLine = flow.sequential
      ? "Sequential mode is ON, so approval requests are sent one by one in the listed order."
      : "Sequential mode is OFF, so approval requests are sent to all selected approvers in parallel.";

    const thresholdLine = `Approval threshold is ${flow.min_approval_percentage}%, so at least that percentage of selected approvers must approve.`;

    return [
      `Configured approvers: ${approverNames}.`,
      `Mandatory approvers: ${requiredNames}.`,
      `Auto-approve triggers: ${autoApproveNames}.`,
      managerLine,
      sequenceLine,
      thresholdLine,
    ];
  }, [
    selectedEmployee,
    selectedApprovers,
    requiredApprovers,
    autoApproveApprovers,
    flow.manager_first,
    flow.sequential,
    flow.min_approval_percentage,
  ]);

  return (
    <AppShell>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h2 className="font-display" style={{ fontSize: "1.5rem" }}>Approval Rules</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginTop: "0.2rem" }}>
            Configure expense approval workflows per employee
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: "1.5rem" }} className="rules-layout-grid">
        {/* Left: Employee & Rule Details */}
        <div className="card" style={{ padding: "1.5rem" }}>
          <Select label="Employee" value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)}>
            <option value="">Select Employee</option>
            {employees.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </Select>

          {selectedEmployee && (
            <div style={{ marginTop: "1rem" }}>
              <Input
                label="Rule Description"
                value={flow.description}
                onChange={(e) => setFlow((p) => ({ ...p, description: e.target.value }))}
                placeholder="Rule description"
              />

              <div style={{ marginTop: "1rem" }}>
                <span className="label">Manager</span>
                <p style={{ color: "var(--text-primary)", fontSize: "0.875rem" }}>
                  {selectedEmployee.manager_name || "No manager assigned"}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right: Approvers Configuration */}
        <div className="card" style={{ padding: "1.5rem" }}>
          {!selectedUser ? (
            <div className="empty-state">Select an employee to configure their approval rules</div>
          ) : (
            <>
              {/* Toggles */}
              <div style={{ display: "flex", gap: "2rem", marginBottom: "1.5rem", paddingBottom: "1.25rem", borderBottom: "1px solid var(--border)" }}>
                <Switch
                  label="Manager first approver"
                  checked={flow.manager_first}
                  onChange={(e) => setFlow((p) => ({ ...p, manager_first: e.target.checked }))}
                />
                <Switch
                  label="Sequential approval"
                  checked={flow.sequential}
                  onChange={(e) => setFlow((p) => ({ ...p, sequential: e.target.checked }))}
                />
              </div>

              {/* Approvers list */}
              <div style={{ marginBottom: "1.5rem" }}>
                <span className="label" style={{ marginBottom: "0.75rem" }}>Approvers</span>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {allApprovers.map((approver, idx) => {
                    const isSelected = flow.approverIds.includes(approver.id);
                    const isRequired = flow.requiredApproverIds.includes(approver.id);
                    const isAutoApprove = flow.autoApproveApproverIds.includes(approver.id);
                    return (
                      <div
                        key={approver.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "0.6rem 0.85rem",
                          borderRadius: "var(--radius-sm)",
                          background: isSelected ? "var(--accent-soft)" : "var(--bg-base)",
                          border: `1px solid ${isSelected ? "rgba(240,180,41,0.3)" : "var(--border)"}`,
                          transition: "all 0.15s",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                          <Checkbox
                            checked={isSelected}
                            onChange={() => toggleApprover(approver.id)}
                          />
                          <span style={{ fontWeight: 600, fontSize: "0.85rem", color: isSelected ? "var(--text-primary)" : "var(--text-secondary)" }}>
                            {flow.sequential && isSelected && (
                              <span style={{ color: "var(--accent)", marginRight: "0.5rem", fontSize: "0.75rem" }}>
                                #{flow.approverIds.indexOf(approver.id) + 1}
                              </span>
                            )}
                            {approver.name}
                          </span>
                          <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>({approver.role})</span>
                          {isRequired && (
                            <Badge status="pending">Mandatory</Badge>
                          )}
                          {isAutoApprove && (
                            <Badge status="approved">Auto-approve</Badge>
                          )}
                        </div>
                        {isSelected && (
                          <div style={{ display: "flex", gap: "0.5rem" }}>
                            <Checkbox
                              label="Required"
                              checked={isRequired}
                              onChange={() => toggleRequired(approver.id)}
                            />
                            <Checkbox
                              label="Auto-approve"
                              checked={isAutoApprove}
                              onChange={() => toggleAutoApprove(approver.id)}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {allApprovers.length === 0 && (
                  <p style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>No managers/admins available. Create manager users first.</p>
                )}
              </div>

              <div
                className="card"
                style={{
                  padding: "0.9rem 1rem",
                  marginBottom: "1.5rem",
                  background: "var(--surface-raised)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                  <span className="label" style={{ marginBottom: 0 }}>Approval Sequence Builder</span>
                  <Badge status={flow.sequential ? "approved" : "pending"}>
                    {flow.sequential ? "Sequential: ordered" : "Parallel: order ignored"}
                  </Badge>
                </div>

                {selectedApprovers.length === 0 ? (
                  <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted)" }}>
                    Select approvers above to build a sequence.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {selectedApprovers.map((approver, idx) => (
                      <div
                        key={approver.id}
                        draggable={flow.sequential}
                        onDragStart={() => flow.sequential && setDraggedApproverId(approver.id)}
                        onDragOver={(e) => {
                          if (!flow.sequential) return;
                          e.preventDefault();
                          setDragOverApproverId(approver.id);
                        }}
                        onDragLeave={() => setDragOverApproverId(null)}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (!flow.sequential) return;
                          reorderApprover(draggedApproverId, approver.id);
                          setDragOverApproverId(null);
                          setDraggedApproverId(null);
                        }}
                        onDragEnd={() => {
                          setDragOverApproverId(null);
                          setDraggedApproverId(null);
                        }}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: "0.75rem",
                          padding: "0.6rem 0.7rem",
                          borderRadius: "var(--radius-sm)",
                          border: `1px solid ${dragOverApproverId === approver.id ? "var(--accent)" : "var(--border)"}`,
                          background: "var(--bg-base)",
                          cursor: flow.sequential ? "grab" : "default",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "0.55rem", minWidth: 0 }}>
                          <span style={{ color: "var(--text-muted)", fontSize: "0.74rem", fontWeight: 700, minWidth: "1.5rem" }}>
                            #{idx + 1}
                          </span>
                          <GripVertical size={14} style={{ color: "var(--text-muted)", opacity: flow.sequential ? 1 : 0.4 }} />
                          <div style={{ minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: "0.84rem", fontWeight: 600, color: "var(--text-primary)" }}>{approver.name}</p>
                            <p style={{ margin: "0.08rem 0 0", fontSize: "0.72rem", color: "var(--text-muted)" }}>{approver.role}</p>
                          </div>
                          {flow.requiredApproverIds.includes(approver.id) && <Badge status="pending">Mandatory</Badge>}
                        </div>
                        <div style={{ display: "flex", gap: "0.25rem" }}>
                          <Button size="xs" variant="ghost" disabled={!flow.sequential || idx === 0} onClick={() => moveApprover(approver.id, "up")}>
                            <ArrowUp size={12} />
                          </Button>
                          <Button size="xs" variant="ghost" disabled={!flow.sequential || idx === selectedApprovers.length - 1} onClick={() => moveApprover(approver.id, "down")}>
                            <ArrowDown size={12} />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Min percentage */}
              <div style={{ display: "flex", alignItems: "end", gap: "0.75rem", marginBottom: "1.5rem" }}>
                <div style={{ width: "200px" }}>
                  <Input
                    label="Minimum Approval %"
                    type="number"
                    min="1"
                    max="100"
                    value={flow.min_approval_percentage}
                    onChange={(e) => setFlow((p) => ({ ...p, min_approval_percentage: Number(e.target.value) }))}
                  />
                </div>
                <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: "0.5rem" }}>
                  Expense approved when {flow.min_approval_percentage}% of approvers accept
                </p>
              </div>

              <div
                className="card"
                style={{
                  padding: "1rem",
                  marginBottom: "1.5rem",
                  background: "var(--surface-raised)",
                  borderColor: "rgba(37, 99, 235, 0.25)",
                }}
              >
                <span className="label" style={{ marginBottom: "0.5rem" }}>How this rule works</span>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  {explanation.map((line, idx) => (
                    <p key={idx} style={{ margin: 0, fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                      {line}
                    </p>
                  ))}
                </div>
              </div>

              {/* Save */}
              <Button variant="primary" onClick={handleSave}>
                <Save size={14} />
                {saveMutation.isPending ? "Saving..." : "Save Approval Rule"}
              </Button>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
