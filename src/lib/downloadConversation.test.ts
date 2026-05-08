import { describe, expect, it } from "vitest";
import {
  buildConversationExport,
  EXPORT_FORMAT_VERSION,
  safeDownloadFilename,
} from "@/lib/downloadConversation";
import type { Conversation } from "@/types";

function sampleConv(over: Partial<Conversation> = {}): Conversation {
  return {
    id: "conv-uuid-1",
    profileId: "p1",
    title: "My / Chat: Title!",
    preview: "hi",
    updatedAt: "2026-01-01T00:00:00.000Z",
    messages: [
      { id: "m1", role: "user", body: "Hello", sentAt: "2026-01-01T12:00:00.000Z" },
    ],
    ...over,
  };
}

describe("downloadConversation", () => {
  it("buildConversationExport includes profile and conversation", () => {
    const c = sampleConv();
    const out = buildConversationExport(c, {
      id: "p1",
      displayName: "Ada",
      handle: "ada",
    });
    expect(out.format).toBe(EXPORT_FORMAT_VERSION);
    expect(out.profile).toEqual({
      id: "p1",
      displayName: "Ada",
      handle: "ada",
    });
    expect(out.conversation).toEqual(c);
    expect(out.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("buildConversationExport allows null profile", () => {
    const out = buildConversationExport(sampleConv(), null);
    expect(out.profile).toBeNull();
  });

  it("safeDownloadFilename slugifies title and shortens id", () => {
    expect(safeDownloadFilename("My / Chat: Title!", "conv-uuid-1")).toBe(
      "My-Chat-Title-convuuid.json",
    );
  });
});
