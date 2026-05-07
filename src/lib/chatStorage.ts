import type { Conversation } from "@/types";

const STORAGE_PREFIX = "single-thread:chats:";
export const SELECTED_PROFILE_STORAGE_KEY = "single-thread:selectedProfileId";
export const GUEST_PROFILE_ID = "__guest__";

export function loadConversations(profileId: string): Conversation[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + profileId);
    if (!raw) return null;
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return null;
    return normalizeConversations(profileId, data as Conversation[]);
  } catch {
    return null;
  }
}

function normalizeConversations(profileId: string, list: Conversation[]): Conversation[] {
  return list.map((c) => ({
    ...c,
    profileId: typeof c.profileId === "string" ? c.profileId : profileId,
  }));
}

export function saveConversations(profileId: string, list: Conversation[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_PREFIX + profileId, JSON.stringify(list));
  } catch {
    /* quota or private mode */
  }
}

export function readSelectedProfileId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(SELECTED_PROFILE_STORAGE_KEY);
    return v && v.length > 0 ? v : null;
  } catch {
    return null;
  }
}

export function writeSelectedProfileId(profileId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SELECTED_PROFILE_STORAGE_KEY, profileId);
  } catch {
    /* ignore */
  }
}
