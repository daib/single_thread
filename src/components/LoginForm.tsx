"use client";

import { getProviders, signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";
  const [providers, setProviders] = useState<Awaited<ReturnType<typeof getProviders>>>(null);

  useEffect(() => {
    void getProviders().then(setProviders);
  }, []);

  if (!providers) {
    return <p className="login-loading">Loading sign-in options…</p>;
  }

  const list = Object.values(providers).filter((p) => p.type === "oauth" || p.type === "oidc");

  if (list.length === 0) {
    return <p className="login-error">No OAuth providers are configured.</p>;
  }

  return (
    <div className="login-providers">
      {list.map((provider) => {
        const isGoogle = provider.id === "google";
        return (
          <button
            key={provider.id}
            type="button"
            className={
              isGoogle ? "login-provider-btn login-provider-btn-google" : "login-provider-btn login-provider-btn-facebook"
            }
            onClick={() => signIn(provider.id, { callbackUrl })}
          >
            Continue with {provider.name}
          </button>
        );
      })}
    </div>
  );
}
