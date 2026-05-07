"use client";

import Image from "next/image";
import { signIn, signOut, useSession } from "next-auth/react";

interface NavAuthProps {
  facebookEnabled: boolean;
}

export function NavAuth({ facebookEnabled }: NavAuthProps) {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <span className="app-nav-auth app-nav-auth-muted">…</span>;
  }

  if (!session?.user) {
    return (
      <div className="app-nav-auth-signin">
        <button
          type="button"
          className="app-nav-auth-btn app-nav-auth-btn-primary"
          onClick={() => signIn("google", { callbackUrl: "/" })}
        >
          Google
        </button>
        {facebookEnabled ? (
          <button
            type="button"
            className="app-nav-auth-btn app-nav-auth-btn-facebook"
            onClick={() => signIn("facebook", { callbackUrl: "/" })}
          >
            Facebook
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="app-nav-auth">
      {session.user.image ? (
        <Image
          src={session.user.image}
          alt=""
          width={28}
          height={28}
          className="app-nav-avatar"
          unoptimized
        />
      ) : null}
      <span className="app-nav-auth-name" title={session.user.email ?? undefined}>
        {session.user.name ?? session.user.email ?? "Signed in"}
      </span>
      <button type="button" className="app-nav-auth-btn" onClick={() => signOut({ callbackUrl: "/" })}>
        Sign out
      </button>
    </div>
  );
}
