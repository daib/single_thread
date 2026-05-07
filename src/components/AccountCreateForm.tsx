"use client";

import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { type FormEvent, useState } from "react";

export function AccountCreateForm() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/account", {
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

  return (
    <section className="account-card" aria-labelledby="create-account-heading">
      <h2 id="create-account-heading" className="account-card-title">
        New account
      </h2>
      <form className="account-form" onSubmit={onSubmit}>
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
          />
        </label>
        <label className="account-field">
          <span className="account-label">Handle</span>
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
          />
          <span className="account-hint">Unique. Lowercase, e.g. ada_lovelace</span>
        </label>
        <label className="account-field">
          <span className="account-label">Bio (optional)</span>
          <textarea
            name="bio"
            rows={3}
            maxLength={2000}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="A short note about you…"
          />
        </label>
        {error ? (
          <p className="account-form-error" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" className="account-submit" disabled={pending}>
          {pending ? "Saving…" : "Create account"}
        </button>
        <button
          type="button"
          className="account-signout"
          onClick={() => signOut({ callbackUrl: "/" })}
        >
          Sign out
        </button>
      </form>
    </section>
  );
}
