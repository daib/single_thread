"use client";

import Image from "next/image";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useMemo, useRef, useState } from "react";

export function SidebarAccountMenu() {
  const { data: session } = useSession();
  const user = session?.user;
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const displayName = user?.name?.trim() || user?.email?.trim() || "Signed in";
  const initial = useMemo(() => {
    const m = displayName.match(/[a-z0-9]/i);
    return m ? m[0]!.toUpperCase() : "?";
  }, [displayName]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) {
    return null;
  }

  return (
    <div className="sidebar-account-menu-wrap" ref={wrapRef}>
      <button
        type="button"
        className="sidebar-account-menu-trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Account menu for ${displayName}`}
        title={displayName}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="sidebar-account-menu-user">
          {user.image ? (
            <Image
              src={user.image}
              alt=""
              width={28}
              height={28}
              className="sidebar-account-menu-avatar"
              unoptimized
            />
          ) : (
            <span className="sidebar-account-menu-placeholder" aria-hidden>
              {initial}
            </span>
          )}
          <span className="sidebar-account-menu-name">{displayName}</span>
        </span>
        <span className="sidebar-account-menu-chevron" aria-hidden>
          {open ? "▴" : "▾"}
        </span>
      </button>
      {open ? (
        <div className="sidebar-account-menu-dropdown" role="menu">
          <Link
            href="/account"
            className="sidebar-account-menu-item"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            Account settings
          </Link>
          <button
            type="button"
            className="sidebar-account-menu-item sidebar-account-menu-item-danger"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              void signOut({ callbackUrl: "/" });
            }}
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
