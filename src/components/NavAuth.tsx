"use client";

import Image from "next/image";
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

  return (
    <div className="app-nav-auth">
      <Link href="/account" className="app-nav-link">
        Account
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
    </div>
  );
}
