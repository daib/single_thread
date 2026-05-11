"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

export type AccountOption = {
  id: string;
  displayName: string;
  handle: string;
};

type Props = {
  accounts: AccountOption[];
};

export function ProfileCreateForm({ accounts }: Props) {
  const router = useRouter();
  const [accountId, setAccountId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (accounts.length === 0) {
      setAccountId("");
      return;
    }
    setAccountId((current) => {
      if (current && accounts.some((a) => a.id === current)) return current;
      return accounts[0].id;
    });
  }, [accounts]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!accountId) {
      setError("Create an account first.");
      return;
    }
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
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? `Request failed (${res.status})`);
        return;
      }
      setDisplayName("");
      setHandle("");
      setBio("");
      router.refresh();
    } catch {
      setError("Network error. Is the dev server running?");
    } finally {
      setPending(false);
    }
  }

  const disabled = accounts.length === 0;

  return (
    <section className="account-card" aria-labelledby="create-profile-heading">
      <h2 id="create-profile-heading" className="account-card-title">
        New profile
      </h2>
      <p className="account-card-lede">
        You can add several profiles to your account. Each profile handle must be unique within the account.
      </p>
      <form className="account-form" onSubmit={onSubmit}>
        {accounts.length > 1 ? (
          <label className="account-field">
            <span className="account-label">Account</span>
            <select
              name="accountId"
              className="account-select"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              disabled={disabled}
              required={!disabled}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.displayName} (@{a.handle})
                </option>
              ))}
            </select>
          </label>
        ) : accounts.length === 1 ? (
          <p className="account-profile-target">
            Profiles for <strong>{accounts[0].displayName}</strong>{" "}
            <span className="account-profile-target-handle">@{accounts[0].handle}</span>
          </p>
        ) : null}
        <label className="account-field">
          <span className="account-label">Display name</span>
          <input
            name="displayName"
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
        <label className="account-field">
          <span className="account-label">Profile handle</span>
          <input
            name="handle"
            type="text"
            autoComplete="username"
            required
            maxLength={31}
            value={handle}
            onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
            placeholder="ada"
            pattern="[a-z0-9][a-z0-9_-]{1,30}"
            title="2–31 chars: lowercase letters, digits, underscore, hyphen"
            disabled={disabled}
          />
          <span className="account-hint">Unique within the selected account.</span>
        </label>
        <label className="account-field">
          <span className="account-label">Bio (optional)</span>
          <textarea
            name="bio"
            rows={3}
            maxLength={2000}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="A short note…"
            disabled={disabled}
          />
        </label>
        {error ? (
          <p className="account-form-error" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" className="account-submit" disabled={pending || disabled}>
          {pending ? "Saving…" : "Create profile"}
        </button>
      </form>
    </section>
  );
}
