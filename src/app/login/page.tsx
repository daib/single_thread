import { Suspense } from "react";
import { LoginForm } from "@/components/LoginForm";

export const metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-title">Sign in</h1>
        <p className="login-subtitle">Choose a provider to continue.</p>
        <Suspense fallback={<p className="login-loading">Loading…</p>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
