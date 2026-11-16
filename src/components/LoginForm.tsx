"use client";

import { loginDashboard } from "@/lib/admin-api";
import { storeDashboardSession } from "@/lib/auth-storage";
import { getDefaultDashboardHref } from "@/lib/dashboard-permissions";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { FormEvent, useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await loginDashboard(email, password);
      if (data.role !== "admin" && data.role !== "staff") {
        setError("This account does not have dashboard access.");
        return;
      }

      const user = {
        ...data.user,
        role: data.role,
      };

      storeDashboardSession({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        user,
      });
      router.replace(getDefaultDashboardHref(user));
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : "Login failed. Please check the credentials."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="login-card" onSubmit={onSubmit}>
      <h2>Sign in</h2>
      <p>Use an owner/admin or staff operator account.</p>
      <div className="field">
        <label htmlFor="email">Email address</label>
        <input
          autoComplete="email"
          id="email"
          name="email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="admin@owvo.co.uk"
          required
          type="email"
          value={email}
        />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <span className="password-input-shell">
          <input
            autoComplete="current-password"
            id="password"
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            required
            type={showPassword ? "text" : "password"}
            value={password}
          />
          <button
            aria-label={showPassword ? "Hide password" : "Show password"}
            onClick={() => setShowPassword((value) => !value)}
            type="button"
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </span>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      <button className="primary-button" disabled={loading} type="submit">
        {loading ? "Signing in..." : "Continue"}
      </button>
    </form>
  );
}
