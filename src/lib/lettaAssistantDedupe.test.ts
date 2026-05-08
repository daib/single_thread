import { describe, expect, it } from "vitest";
import {
  getLastAssistantBeforeTrailingUser,
  messagesBodiesDuplicate,
  normalizeForDedupe,
  shouldShowAssistantReply,
} from "@/lib/lettaAssistantDedupe";
import type { Message } from "@/types";

describe("normalizeForDedupe", () => {
  it("collapses whitespace", () => {
    expect(normalizeForDedupe("  a \n\t b  ")).toBe("a b");
  });
});

describe("messagesBodiesDuplicate", () => {
  it("compares after normalization", () => {
    expect(messagesBodiesDuplicate("hello  world", "hello world")).toBe(true);
    expect(messagesBodiesDuplicate("a", "b")).toBe(false);
  });
});

describe("getLastAssistantBeforeTrailingUser", () => {
  const u = (body: string): Message => ({
    id: "u",
    role: "user",
    body,
    sentAt: "2026-01-01T00:00:00.000Z",
  });
  const a = (body: string): Message => ({
    id: "a",
    role: "assistant",
    body,
    sentAt: "2026-01-01T00:00:00.000Z",
  });

  it("returns undefined for empty", () => {
    expect(getLastAssistantBeforeTrailingUser([])).toBeUndefined();
  });

  it("when last is user, returns previous assistant", () => {
    expect(getLastAssistantBeforeTrailingUser([a("old"), u("new")])).toBe("old");
  });

  it("when last is user and no prior assistant", () => {
    expect(getLastAssistantBeforeTrailingUser([u("only")])).toBeUndefined();
  });

  it("when last is assistant, scans backward for assistant", () => {
    expect(getLastAssistantBeforeTrailingUser([u("x"), a("reply")])).toBe("reply");
  });
});

describe("shouldShowAssistantReply", () => {
  it("rejects empty", () => {
    expect(shouldShowAssistantReply("   ")).toBe(false);
  });

  it("rejects none/null placeholders", () => {
    expect(shouldShowAssistantReply("none")).toBe(false);
    expect(shouldShowAssistantReply("NULL")).toBe(false);
  });

  it("accepts normal text", () => {
    expect(shouldShowAssistantReply("Hello")).toBe(true);
  });
});
