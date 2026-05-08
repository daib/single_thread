"use client";

import { useEffect, useRef, useState } from "react";
import { DeleteProfileDialog } from "@/components/DeleteProfileDialog";
import { QuickProfileDialog, type QuickAccountOption } from "@/components/QuickProfileDialog";
import type { ChatProfileOption } from "@/types";

function profileInitial(profile: ChatProfileOption | undefined): string {
  if (!profile) return "?";
  const m = profile.displayName.match(/[a-z0-9]/i);
  return m ? m[0]!.toUpperCase() : "?";
}

function NewProfileIcon() {
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
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" x2="19" y1="8" y2="14" />
      <line x1="22" x2="16" y1="11" y2="11" />
    </svg>
  );
}

function DeleteProfileIcon() {
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
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" x2="10" y1="11" y2="17" />
      <line x1="14" x2="14" y1="11" y2="17" />
    </svg>
  );
}

type Props = {
  status: "loading" | "authenticated" | "unauthenticated"; // mirrors useSession()
  profiles: ChatProfileOption[];
  value: string | null;
  onChange: (profileId: string) => void;
  /** Signed-in user’s accounts (for quick profile creation). Omit for guests. */
  accounts?: QuickAccountOption[];
  onProfileCreated?: (profile: ChatProfileOption) => void;
  /** Signed-in: deletes profile and all DB chats for it (confirmation dialog). */
  onProfileDeleted?: (profileId: string) => Promise<void>;
};

export function ProfileChatSelect({
  status,
  profiles,
  value,
  onChange,
  accounts = [],
  onProfileCreated,
  onProfileDeleted,
}: Props) {
  const [quickProfileOpen, setQuickProfileOpen] = useState(false);
  const [deleteProfileOpen, setDeleteProfileOpen] = useState(false);
  const busy = status === "loading";
  const signedInNoProfiles = status === "authenticated" && profiles.length === 0;
  const canQuickCreate =
    status === "authenticated" && accounts.length > 0 && typeof onProfileCreated === "function";
  const selectedProfile = value ? profiles.find((p) => p.id === value) : undefined;
  const canDeleteProfile =
    status === "authenticated" &&
    typeof onProfileDeleted === "function" &&
    Boolean(selectedProfile);

  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!profileMenuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (profileMenuRef.current?.contains(e.target as Node)) return;
      setProfileMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setProfileMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [profileMenuOpen]);

  return (
    <div className="sidebar-profile-panel">
      <label className="profile-chat-label" id="profile-chat-label" htmlFor="chat-profile-select-trigger">
        Chatting as
      </label>
      {busy ? (
        <span className="profile-chat-status">Loading profiles…</span>
      ) : signedInNoProfiles ? (
        <div className="profile-chat-empty-signed-in">
          <p className="profile-chat-hint">No profiles yet.</p>
          {canQuickCreate ? (
            <button
              type="button"
              className="profile-chat-new-profile-btn"
              onClick={() => setQuickProfileOpen(true)}
            >
              <span className="profile-chat-action-icon">
                <NewProfileIcon />
              </span>
              New profile
            </button>
          ) : (
            <p className="profile-chat-status">Create an account or open Account below.</p>
          )}
        </div>
      ) : (
        <div className="profile-chat-controls">
          <div className="sidebar-account-menu-wrap" ref={profileMenuRef}>
            <button
              type="button"
              id="chat-profile-select-trigger"
              className="sidebar-account-menu-trigger"
              aria-expanded={profileMenuOpen}
              aria-haspopup="listbox"
              disabled={profiles.length === 0}
              onClick={() => profiles.length > 0 && setProfileMenuOpen((v) => !v)}
            >
              <span className="sidebar-account-menu-user">
                <span className="sidebar-account-menu-placeholder" aria-hidden>
                  {profileInitial(selectedProfile)}
                </span>
                <span className="sidebar-account-menu-name">
                  {selectedProfile ? (
                    <>
                      {selectedProfile.displayName}
                      <span className="profile-chat-select-handle">@{selectedProfile.handle}</span>
                    </>
                  ) : (
                    "—"
                  )}
                </span>
              </span>
              <span className="sidebar-account-menu-chevron" aria-hidden>
                {profileMenuOpen ? "▴" : "▾"}
              </span>
            </button>
            {profileMenuOpen && profiles.length > 0 ? (
              <div
                className="sidebar-account-menu-dropdown sidebar-account-menu-dropdown--below"
                role="listbox"
                aria-labelledby="profile-chat-label"
              >
                {profiles.map((p) => {
                  const active = p.id === value;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={`sidebar-account-menu-item${active ? " sidebar-account-menu-item-active" : ""}`}
                      onClick={() => {
                        onChange(p.id);
                        setProfileMenuOpen(false);
                      }}
                    >
                      {p.displayName}
                      <span className="profile-chat-select-handle">@{p.handle}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
          {canQuickCreate ? (
            <button
              type="button"
              className="profile-chat-new-profile-btn"
              onClick={() => setQuickProfileOpen(true)}
            >
              <span className="profile-chat-action-icon">
                <NewProfileIcon />
              </span>
              New profile
            </button>
          ) : null}
          {canDeleteProfile ? (
            <button
              type="button"
              className="profile-chat-delete-profile-btn"
              onClick={() => setDeleteProfileOpen(true)}
            >
              <span className="profile-chat-action-icon">
                <DeleteProfileIcon />
              </span>
              Delete profile
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
            onProfileCreated?.(profile);
          }}
        />
      ) : null}
      {canDeleteProfile && selectedProfile ? (
        <DeleteProfileDialog
          open={deleteProfileOpen}
          displayName={selectedProfile.displayName}
          handle={selectedProfile.handle}
          onClose={() => setDeleteProfileOpen(false)}
          onConfirm={() => onProfileDeleted(selectedProfile.id)}
        />
      ) : null}
    </div>
  );
}
