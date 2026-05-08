"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";

export function NavAuth() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <span className="app-nav-auth app-nav-auth-muted">…</span>;
  }

  if (!session?.user) {
    return (
      <Link
        href={`/login?callbackUrl=${encodeURIComponent("/")}`}
        prefetch={false}
        className="app-nav-link app-nav-link-signin"
      >
        Sign in
      </Link>
    );
  }

  return null;
}
