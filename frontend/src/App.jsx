import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./components/layout/protected-route";
import { AdminPage } from "./pages/admin-page";
import { AdminRulesPage } from "./pages/admin-rules-page";
import { AnalyticsPage } from "./pages/analytics-page";
import { AuditPage } from "./pages/audit-page";
import { AuthPage } from "./pages/auth-page";
import { EmployeePage } from "./pages/employee-page";
import { ManagerPage } from "./pages/manager-page";

function App() {
  return (
    <Routes>
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/admin" element={<ProtectedRoute allowedRoles={["admin"]}><AdminPage /></ProtectedRoute>} />
      <Route path="/admin/rules" element={<ProtectedRoute allowedRoles={["admin"]}><AdminRulesPage /></ProtectedRoute>} />
      <Route path="/admin/analytics" element={<ProtectedRoute allowedRoles={["admin"]}><AnalyticsPage /></ProtectedRoute>} />
      <Route path="/audit" element={<ProtectedRoute allowedRoles={["admin", "manager"]}><AuditPage /></ProtectedRoute>} />
      <Route path="/employee" element={<ProtectedRoute allowedRoles={["employee"]}><EmployeePage /></ProtectedRoute>} />
      <Route path="/manager" element={<ProtectedRoute allowedRoles={["manager", "admin"]}><ManagerPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/auth" replace />} />
    </Routes>
  );
}

export default App;
