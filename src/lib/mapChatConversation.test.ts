import { describe, expect, it } from "vitest";
import { mapConversation, mapMessage } from "@/lib/mapChatConversation";
import type { ChatConversation, ChatMessage } from "@prisma/client";

function dbMsg(partial: Partial<ChatMessage> & Pick<ChatMessage, "id" | "body" | "role">): ChatMessage {
  return {
    conversationId: partial.conversationId ?? "c1",
    sentAt: partial.sentAt ?? new Date("2026-01-01T12:00:00.000Z"),
    ...partial,
  } as ChatMessage;
}

function dbConv(
  partial: Partial<ChatConversation> & Pick<ChatConversation, "id" | "title">,
  messages: ChatMessage[],
): ChatConversation & { messages: ChatMessage[] } {
  return {
    profileId: partial.profileId ?? "p1",
    preview: partial.preview ?? "",
    branchOfId: partial.branchOfId ?? null,
    lettaConversationId: partial.lettaConversationId ?? null,
    createdAt: partial.createdAt ?? new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: partial.updatedAt ?? new Date("2026-01-02T00:00:00.000Z"),
    ...partial,
    messages,
  } as ChatConversation & { messages: ChatMessage[] };
}

describe("mapMessage", () => {
  it("maps assistant role", () => {
    const m = dbMsg({
      id: "m1",
      role: "assistant",
      body: "Hi",
      sentAt: new Date("2026-01-01T10:00:00.000Z"),
    });
    expect(mapMessage(m)).toEqual({
      id: "m1",
      role: "assistant",
      body: "Hi",
      sentAt: "2026-01-01T10:00:00.000Z",
    });
  });

  it("maps non-assistant to user", () => {
    const m = dbMsg({
      id: "m2",
      role: "user",
      body: "Yo",
      sentAt: new Date("2026-01-01T11:00:00.000Z"),
    });
    expect(mapMessage(m).role).toBe("user");
  });
});

describe("mapConversation", () => {
  it("sorts messages by sentAt ascending", () => {
    const conv = dbConv(
      { id: "c1", title: "T" },
      [
        dbMsg({ id: "m2", role: "user", body: "second", sentAt: new Date("2026-01-01T11:00:00.000Z") }),
        dbMsg({ id: "m1", role: "user", body: "first", sentAt: new Date("2026-01-01T10:00:00.000Z") }),
      ],
    );
    const out = mapConversation(conv, "p9");
    expect(out.messages.map((m) => m.body)).toEqual(["first", "second"]);
    expect(out.profileId).toBe("p9");
  });

  it("uses preview when set", () => {
    const conv = dbConv({ id: "c1", title: "T", preview: "Pinned preview" }, []);
    expect(mapConversation(conv, "p1").preview).toBe("Pinned preview");
  });

  it("derives preview from last message when preview empty", () => {
    const long = "x".repeat(200);
    const conv = dbConv(
      { id: "c1", title: "T", preview: "" },
      [dbMsg({ id: "m1", role: "user", body: long, sentAt: new Date("2026-01-01T10:00:00.000Z") })],
    );
    expect(mapConversation(conv, "p1").preview).toBe(long.slice(0, 120));
  });

  it("uses default preview when no messages", () => {
    const conv = dbConv({ id: "c1", title: "T", preview: "" }, []);
    expect(mapConversation(conv, "p1").preview).toBe("No messages yet");
  });

  it("includes branchOfId when present", () => {
    const conv = dbConv({ id: "c1", title: "T", branchOfId: "parent" }, []);
    expect(mapConversation(conv, "p1").branchOfId).toBe("parent");
  });

  it("omits branchOfId when null", () => {
    const conv = dbConv({ id: "c1", title: "T", branchOfId: null }, []);
    expect(mapConversation(conv, "p1").branchOfId).toBeUndefined();
  });
});
