"use client";

import Image from "next/image";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useMemo, useRef, useState } from "react";

function SettingsIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" x2="9" y1="12" y2="12" />
    </svg>
  );
}

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
            <span className="sidebar-account-menu-item-icon">
              <SettingsIcon />
            </span>
            Settings
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
            <span className="sidebar-account-menu-item-icon">
              <SignOutIcon />
            </span>
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
