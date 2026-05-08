"use client";

import Link from "next/link";
import { useState } from "react";
import { QuickProfileDialog, type QuickAccountOption } from "@/components/QuickProfileDialog";
import type { ChatProfileOption } from "@/types";

type Props = {
  status: "loading" | "authenticated" | "unauthenticated"; // mirrors useSession()
  profiles: ChatProfileOption[];
  value: string | null;
  onChange: (profileId: string) => void;
  /** Signed-in user’s accounts (for quick profile creation). Omit for guests. */
  accounts?: QuickAccountOption[];
  onProfileCreated?: (profile: ChatProfileOption) => void;
};

export function ProfileChatSelect({
  status,
  profiles,
  value,
  onChange,
  accounts = [],
  onProfileCreated,
}: Props) {
  const [quickProfileOpen, setQuickProfileOpen] = useState(false);
  const busy = status === "loading";
  const signedInNoProfiles = status === "authenticated" && profiles.length === 0;
  const canQuickCreate =
    status === "authenticated" && accounts.length > 0 && typeof onProfileCreated === "function";

  return (
    <div className="profile-chat-bar">
      <label className="profile-chat-label" htmlFor="chat-profile-select">
        Chatting as
      </label>
      {busy ? (
        <span className="profile-chat-status">Loading profiles…</span>
      ) : signedInNoProfiles ? (
        <span className="profile-chat-hint profile-chat-hint-row">
          <span className="profile-chat-empty-lede">No profiles yet.</span>
          {canQuickCreate ? (
            <>
              <button
                type="button"
                className="profile-chat-new-profile-btn"
                onClick={() => setQuickProfileOpen(true)}
              >
                New profile
              </button>
              <span className="profile-chat-hint-sep" aria-hidden>
                ·
              </span>
              <Link href="/account" className="profile-chat-link">
                Account settings
              </Link>
            </>
          ) : (
            <Link href="/account" className="profile-chat-link">
              Create one in Account
            </Link>
          )}
        </span>
      ) : (
        <div className="profile-chat-controls">
          <select
            id="chat-profile-select"
            className="profile-chat-select"
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={profiles.length === 0}
          >
            {profiles.length === 0 ? (
              <option value="">—</option>
            ) : (
              profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.displayName} (@{p.handle})
                </option>
              ))
            )}
          </select>
          {canQuickCreate ? (
            <button
              type="button"
              className="profile-chat-new-profile-btn"
              onClick={() => setQuickProfileOpen(true)}
            >
              New profile
            </button>
          ) : null}
        </div>
      )}
      {canQuickCreate ? (
        <QuickProfileDialog
          open={quickProfileOpen}
          onClose={() => setQuickProfileOpen(false)}
          accounts={accounts}
          onSuccess={(profile) => {
            onProfileCreated(profile);
          }}
        />
      ) : null}
    </div>
  );
}
