import type { Conversation } from "./types";

const iso = (minsAgo: number) =>
  new Date(Date.now() - minsAgo * 60_000).toISOString();

const demoTemplate: Omit<Conversation, "profileId">[] = [
  {
    id: "c1",
    title: "Design sync",
    preview: "Can we tighten the spacing on the sidebar?",
    updatedAt: iso(12),
    messages: [
      {
        id: "m1",
        role: "user",
        body: "Can we tighten the spacing on the sidebar?",
        sentAt: iso(14),
      },
      {
        id: "m2",
        role: "assistant",
        body: "Yes — reducing vertical gap from 12px to 8px and using a single-line preview keeps scan speed high without feeling cramped.",
        sentAt: iso(13),
      },
      {
        id: "m3",
        role: "user",
        body: "Perfect. I'll ship that in the next pass.",
        sentAt: iso(12),
      },
    ],
  },
  {
    id: "c2",
    title: "API errors",
    preview: "422 on /sessions — payload shape?",
    updatedAt: iso(45),
    messages: [
      {
        id: "m4",
        role: "user",
        body: "Getting 422 on POST /sessions. Is the payload shape wrong?",
        sentAt: iso(48),
      },
      {
        id: "m5",
        role: "assistant",
        body: "The server expects `{ conversationId: string, messages: { role, content }[] }`. Rename `body` → `content` and include a UUID for `conversationId`.",
        sentAt: iso(45),
      },
    ],
  },
  {
    id: "c3",
    title: "Weekend hike",
    preview: "Trailhead opens at 6 — bring layers.",
    updatedAt: iso(180),
    messages: [
      {
        id: "m6",
        role: "assistant",
        body: "Trailhead opens at 6 — bring layers. Weather looks clear until noon.",
        sentAt: iso(200),
      },
      {
        id: "m7",
        role: "user",
        body: "Noted. Coffee first, then we roll.",
        sentAt: iso(180),
      },
    ],
  },
];

/** Demo threads for a profile; conversations are stored separately per `profileId` in the browser. */
export function seedConversations(profileId: string): Conversation[] {
  return demoTemplate.map((c) => ({ ...c, profileId }));
}
