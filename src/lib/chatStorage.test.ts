import { beforeEach, describe, expect, it } from "vitest";
import {
  clearSelectedProfileId,
  GUEST_PROFILE_ID,
  hydrateConversationsForProfile,
  loadConversations,
  readSelectedProfileId,
  saveConversations,
  SELECTED_PROFILE_STORAGE_KEY,
  writeSelectedProfileId,
} from "@/lib/chatStorage";
import type { Conversation, Message } from "@/types";

const CHAT_KEY = (profileId: string) => `single-thread:chats:${profileId}`;

/** Vitest’s jsdom localStorage can be incomplete; use an in-memory Storage. */
function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    },
    removeItem(key: string) {
      map.delete(key);
    },
    key(index: number) {
      const keys = Array.from(map.keys());
      return keys[index] ?? null;
    },
  } as Storage;
}

function sampleConv(id: string, profileId = "p1"): Conversation {
  const m: Message = {
    id: "m1",
    role: "user",
    body: "hi",
    sentAt: "2026-01-01T00:00:00.000Z",
  };
  return {
    id,
    profileId,
    title: "Chat",
    preview: "p",
    updatedAt: "2026-01-01T00:00:00.000Z",
    messages: [m],
  };
}

describe("chatStorage", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "localStorage", {
      value: createMemoryStorage(),
      configurable: true,
      writable: true,
    });
  });

  it("round-trips conversations", () => {
    const list = [sampleConv("c1")];
    saveConversations("p1", list);
    expect(loadConversations("p1")).toEqual(list);
  });

  it("loadConversations returns null for missing key", () => {
    expect(loadConversations("missing")).toBeNull();
  });

  it("loadConversations returns null for invalid JSON", () => {
    localStorage.setItem(CHAT_KEY("p1"), "{not json");
    expect(loadConversations("p1")).toBeNull();
  });

  it("loadConversations returns null when data is not an array", () => {
    localStorage.setItem(CHAT_KEY("p1"), JSON.stringify({ foo: 1 }));
    expect(loadConversations("p1")).toBeNull();
  });

  it("fills profileId when stored row has non-string profileId", () => {
    const row = { ...sampleConv("c1"), profileId: null as unknown as string };
    localStorage.setItem(CHAT_KEY("p1"), JSON.stringify([row]));
    const loaded = loadConversations("p1");
    expect(loaded?.[0]?.profileId).toBe("p1");
  });

  it("hydrateConversationsForProfile seeds empty list when key absent", () => {
    const first = hydrateConversationsForProfile(GUEST_PROFILE_ID);
    expect(first).toEqual([]);
    expect(localStorage.getItem(CHAT_KEY(GUEST_PROFILE_ID))).toBe("[]");
    const second = hydrateConversationsForProfile(GUEST_PROFILE_ID);
    expect(second).toEqual([]);
  });

  it("hydrateConversationsForProfile resets corrupt JSON to empty", () => {
    localStorage.setItem(CHAT_KEY("p9"), "[[");
    const out = hydrateConversationsForProfile("p9");
    expect(out).toEqual([]);
    expect(localStorage.getItem(CHAT_KEY("p9"))).toBe("[]");
  });

  it("hydrateConversationsForProfile resets non-array JSON", () => {
    localStorage.setItem(CHAT_KEY("p8"), JSON.stringify({ x: 1 }));
    expect(hydrateConversationsForProfile("p8")).toEqual([]);
  });

  it("read/write selected profile id", () => {
    expect(readSelectedProfileId()).toBeNull();
    writeSelectedProfileId("abc");
    expect(readSelectedProfileId()).toBe("abc");
    expect(localStorage.getItem(SELECTED_PROFILE_STORAGE_KEY)).toBe("abc");
    clearSelectedProfileId();
    expect(readSelectedProfileId()).toBeNull();
  });
});
