"use client";

import Link from "next/link";
import type { ChatProfileOption } from "@/types";

type Props = {
  status: "loading" | "authenticated" | "unauthenticated"; // mirrors useSession()
  profiles: ChatProfileOption[];
  value: string | null;
  onChange: (profileId: string) => void;
};

export function ProfileChatSelect({ status, profiles, value, onChange }: Props) {
  const busy = status === "loading";
  const signedInNoProfiles = status === "authenticated" && profiles.length === 0;

  return (
    <div className="profile-chat-bar">
      <label className="profile-chat-label" htmlFor="chat-profile-select">
        Chatting as
      </label>
      {busy ? (
        <span className="profile-chat-status">Loading profiles…</span>
      ) : signedInNoProfiles ? (
        <span className="profile-chat-hint">
          No profiles yet.{" "}
          <Link href="/account" className="profile-chat-link">
            Create one in Account
          </Link>
        </span>
      ) : (
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
      )}
    </div>
  );
}
