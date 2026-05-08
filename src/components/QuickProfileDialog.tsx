"use client";

import { type FormEvent, useEffect, useId, useState } from "react";
import type { ChatProfileOption } from "@/types";

export type QuickAccountOption = {
  id: string;
  displayName: string;
  handle: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  accounts: QuickAccountOption[];
  onSuccess: (profile: ChatProfileOption) => void;
};

export function QuickProfileDialog({ open, onClose, accounts, onSuccess }: Props) {
  const titleId = useId();
  const [accountId, setAccountId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setPending(false);
    if (accounts.length === 0) {
      setAccountId("");
      return;
    }
    setAccountId((cur) => (cur && accounts.some((a) => a.id === cur) ? cur : accounts[0]!.id));
  }, [open, accounts]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, pending]);

  if (!open) return null;

  const disabled = accounts.length === 0 || !accountId;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (disabled) return;
    setPending(true);
    try {
      const res = await fetch(`/api/account/${encodeURIComponent(accountId)}/profiles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim(),
          handle: handle.trim(),
          bio: bio.trim() || undefined,
        }),
      });
      const data = (await res.json()) as {
        id?: string;
        displayName?: string;
        handle?: string;
        error?: string;
      };
      if (!res.ok || !data.id || !data.displayName || !data.handle) {
        setError(data.error ?? `Request failed (${res.status})`);
        return;
      }
      onSuccess({
        id: data.id,
        displayName: data.displayName,
        handle: data.handle,
      });
      setDisplayName("");
      setHandle("");
      setBio("");
      onClose();
    } catch {
      setError("Network error.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="quick-profile-dialog-root">
      <div className="quick-profile-dialog-backdrop" role="presentation" onClick={() => !pending && onClose()} />
      <div
        className="quick-profile-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="quick-profile-dialog-title">
          New profile
        </h2>
        <p className="quick-profile-dialog-lede">
          Each profile has its own chats. The handle must be unique on your account (lowercase letters, digits,{" "}
          <span className="quick-profile-mono">_</span> and <span className="quick-profile-mono">-</span>).
        </p>
        <form className="quick-profile-form" onSubmit={onSubmit}>
          {accounts.length > 1 ? (
            <label className="quick-profile-field">
              <span className="quick-profile-label">Account</span>
              <select
                className="quick-profile-select"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                disabled={disabled}
                required
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.displayName} (@{a.handle})
                  </option>
                ))}
              </select>
            </label>
          ) : accounts.length === 1 ? (
            <p className="quick-profile-account-note">
              Under <strong>{accounts[0]!.displayName}</strong>{" "}
              <span className="quick-profile-account-handle">@{accounts[0]!.handle}</span>
            </p>
          ) : (
            <p className="quick-profile-dialog-error" role="alert">
              Create an account under Account first.
            </p>
          )}
          <label className="quick-profile-field">
            <span className="quick-profile-label">Display name</span>
            <input
              className="quick-profile-input"
              type="text"
              autoComplete="name"
              required
              maxLength={120}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Ada Lovelace"
              disabled={disabled}
            />
          </label>
          <label className="quick-profile-field">
            <span className="quick-profile-label">Handle</span>
            <input
              className="quick-profile-input"
              type="text"
              autoComplete="username"
              required
              maxLength={31}
              value={handle}
              onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
              placeholder="ada"
              disabled={disabled}
            />
          </label>
          <label className="quick-profile-field">
            <span className="quick-profile-label">Bio (optional)</span>
            <textarea
              className="quick-profile-textarea"
              rows={2}
              maxLength={2000}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Short note…"
              disabled={disabled}
            />
          </label>
          {error ? (
            <p className="quick-profile-dialog-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="quick-profile-actions">
            <button type="button" className="quick-profile-cancel" disabled={pending} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="quick-profile-submit" disabled={pending || disabled}>
              {pending ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
