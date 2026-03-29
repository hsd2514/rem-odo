import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../context/auth-context";
import { useToast } from "../context/toast-context";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";

export function AuthPage() {
  const navigate = useNavigate();
  const { login, isAuthenticated, role } = useAuth();
  const toast = useToast();
  const [mode, setMode] = useState("login");
  const [signup, setSignup] = useState({
    name: "", email: "", password: "", confirmPassword: "", company_name: "", country: "India",
  });
  const [signin, setSignin] = useState({ email: "", password: "" });

  const countriesQuery = useQuery({ queryKey: ["countries"], queryFn: api.getCountries });

  useEffect(() => {
    if (isAuthenticated && role) navigate(`/${role}`);
  }, [isAuthenticated, role, navigate]);

  const signupMutation = useMutation({
    mutationFn: api.signup,
    onSuccess: (data) => {
      login(data);
      toast.success("Company created! Welcome aboard.");
      navigate("/admin");
    },
    onError: (err) => toast.error(err.message),
  });

  const loginMutation = useMutation({
    mutationFn: ({ email, password }) => api.login({ email, password }),
    onSuccess: (data) => {
      login(data);
      toast.success("Welcome back!");
      navigate(`/${data.role || "employee"}`);
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSignup = () => {
    if (signup.password !== signup.confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }
    if (signup.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    signupMutation.mutate({
      name: signup.name,
      email: signup.email,
      password: signup.password,
      company_name: signup.company_name,
      country: signup.country,
    });
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "grid",
      placeItems: "center",
      padding: "2rem",
      background: "var(--bg-deep)",
    }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: mode === "signup" ? "1fr 1fr" : "1fr",
        gap: "0",
        maxWidth: mode === "signup" ? "820px" : "420px",
        width: "100%",
      }}>
        {/* Left - Branding (signup only) */}
        {mode === "signup" && (
          <div className="card" style={{
            padding: "3rem 2.5rem",
            borderRadius: "var(--radius-lg) 0 0 var(--radius-lg)",
            background: "var(--accent)",
            borderRight: "none",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            color: "#ffffff",
          }}>
            <h1 className="font-display" style={{ fontSize: "2rem", color: "#ffffff", marginBottom: "0.75rem" }}>
              Reimburse
            </h1>
            <p style={{ fontSize: "0.9rem", lineHeight: 1.7, marginBottom: "2rem", opacity: 0.9 }}>
              Streamline your company's expense management with intelligent approval workflows, real-time currency conversion, and OCR-powered receipt processing.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {["Multi-level approval engine", "OCR receipt scanning", "Real-time currency conversion", "Role-based dashboards"].map((f) => (
                <div key={f} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.82rem", opacity: 0.9 }}>
                  <span style={{ fontWeight: 700 }}>✓</span> {f}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Right - Form */}
        <div className="card" style={{
          padding: "2.5rem",
          borderRadius: mode === "signup" ? "0 var(--radius-lg) var(--radius-lg) 0" : "var(--radius-lg)",
        }}>
          {mode === "login" ? (
            <>
              <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
                <h1 className="font-display" style={{ fontSize: "1.75rem", color: "var(--accent)", marginBottom: "0.25rem" }}>Reimburse</h1>
                <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Sign in to your account</p>
              </div>
              <div style={{ display: "grid", gap: "0.85rem" }}>
                <Input label="Email" type="email" placeholder="you@company.com" value={signin.email} onChange={(e) => setSignin((p) => ({ ...p, email: e.target.value }))} />
                <Input label="Password" type="password" placeholder="••••••••" value={signin.password} onChange={(e) => setSignin((p) => ({ ...p, password: e.target.value }))} />
                <Button variant="primary" style={{ width: "100%", marginTop: "0.5rem" }} onClick={() => loginMutation.mutate(signin)}>
                  {loginMutation.isPending ? "Signing in..." : "Sign In"}
                </Button>
              </div>
              <p style={{ marginTop: "1.5rem", textAlign: "center", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                Don't have an account?{" "}
                <button onClick={() => setMode("signup")} style={{ color: "var(--accent)", background: "none", border: "none", cursor: "pointer", fontWeight: 600, fontFamily: "inherit" }}>
                  Create company
                </button>
              </p>
            </>
          ) : (
            <>
              <h2 className="font-display" style={{ fontSize: "1.35rem", marginBottom: "0.25rem" }}>Create Company</h2>
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "1.5rem" }}>Set up your organization</p>
              <div style={{ display: "grid", gap: "0.75rem" }}>
                <Input label="Full Name" placeholder="John Smith" value={signup.name} onChange={(e) => setSignup((p) => ({ ...p, name: e.target.value }))} />
                <Input label="Email" type="email" placeholder="admin@company.com" value={signup.email} onChange={(e) => setSignup((p) => ({ ...p, email: e.target.value }))} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <Input label="Password" type="password" placeholder="••••••••" value={signup.password} onChange={(e) => setSignup((p) => ({ ...p, password: e.target.value }))} />
                  <Input label="Confirm Password" type="password" placeholder="••••••••" value={signup.confirmPassword} onChange={(e) => setSignup((p) => ({ ...p, confirmPassword: e.target.value }))} />
                </div>
                <Input label="Company Name" placeholder="Acme Corp" value={signup.company_name} onChange={(e) => setSignup((p) => ({ ...p, company_name: e.target.value }))} />
                <Select label="Country" value={signup.country} onChange={(e) => setSignup((p) => ({ ...p, country: e.target.value }))}>
                  {(countriesQuery.data || [{ name: "India", currency: "INR" }, { name: "United States", currency: "USD" }]).map((c) => (
                    <option key={c.name} value={c.name}>{c.name} ({c.currency})</option>
                  ))}
                </Select>
                <Button variant="primary" style={{ width: "100%", marginTop: "0.5rem" }} onClick={handleSignup}>
                  {signupMutation.isPending ? "Creating..." : "Create Company"}
                </Button>
              </div>
              <p style={{ marginTop: "1.5rem", textAlign: "center", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                Already have an account?{" "}
                <button onClick={() => setMode("login")} style={{ color: "var(--accent)", background: "none", border: "none", cursor: "pointer", fontWeight: 600, fontFamily: "inherit" }}>
                  Sign in
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
