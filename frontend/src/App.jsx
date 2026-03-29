import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./components/layout/protected-route";
import { AdminPage } from "./pages/admin-page";
import { AdminRulesPage } from "./pages/admin-rules-page";
import { AuthPage } from "./pages/auth-page";
import { EmployeePage } from "./pages/employee-page";
import { ManagerPage } from "./pages/manager-page";

function App() {
  return (
    <Routes>
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
      <Route path="/admin/rules" element={<ProtectedRoute><AdminRulesPage /></ProtectedRoute>} />
      <Route path="/employee" element={<ProtectedRoute><EmployeePage /></ProtectedRoute>} />
      <Route path="/manager" element={<ProtectedRoute><ManagerPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/auth" replace />} />
    </Routes>
  );
}

export default App;
