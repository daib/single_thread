"use client";

import Image from "next/image";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";

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

  return (
    <div className="app-nav-auth">
      <Link href="/profiles" className="app-nav-link">
        Profiles
      </Link>
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
