import React, { useState } from "react";
import { loginUser } from "../../data/authStore";
import Alert from "../common/Alert";

const LoginPage = ({ onLogin, onRegisterNavigate, onForgotPassword }) => {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const result = await loginUser(form.email, form.password);
    if (result.success) {
      onLogin(result.data);
    } else {
      setError(result.error);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <img src="/SPMT.svg" alt="SPMT" className="auth-logo" />
          <h1>SPMT - GROUP 20</h1>
          <p>Smart Property Maintenance Tracker</p>
        </div>
        <form onSubmit={handleSubmit}>
          <Alert msg={error} type="error" />
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">
              Email
            </label>
            <input
              className="form-input"
              type="email"
              name="email"
              id="login-email"
              placeholder="example@spmt.com"
              value={form.email}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <label className="form-label" htmlFor="login-password">
                Password
              </label>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  color: "var(--amber)",
                  cursor: "pointer",
                  textDecoration: "none",
                }}
                onClick={onForgotPassword}
              >
                Forgot Password?
              </span>
            </div>
            <input
              className="form-input"
              type="password"
              name="password"
              id="login-password"
              value={form.password}
              onChange={handleChange}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary btn-full">
            Sign In
          </button>
        </form>
        <div
          style={{
            border: "1px dashed var(--border)",
            borderRadius: 4,
            padding: "8px 12px",
            marginTop: 12,
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--text-dim)",
            lineHeight: 1.6,
          }}
        >
          ⚠ Demo mode: Role enforcement is simulated client-side. In production,
          all access control is enforced server-side via JWT + RBAC middleware
          (SDD NFR-SEC04). Passwords are sha256-hashed for demo purposes;
          production uses bcrypt ≥12 rounds.
        </div>
        <div className="auth-footer">
          <span>Don't have an account?</span>
          <a
            href="/register"
            onClick={(e) => {
              e.preventDefault();
              onRegisterNavigate();
            }}
          >
            Register here
          </a>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
