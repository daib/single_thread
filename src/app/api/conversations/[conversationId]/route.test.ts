// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  requireOwnedConversation: vi.fn(),
  chatConversationDelete: vi.fn(),
  deleteLettaConversationBestEffort: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: mocks.auth,
}));

vi.mock("@/lib/profileAccess", () => ({
  requireOwnedConversation: mocks.requireOwnedConversation,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    chatConversation: { delete: mocks.chatConversationDelete },
  },
}));

vi.mock("@/lib/lettaConversationApi", () => ({
  deleteLettaConversationBestEffort: mocks.deleteLettaConversationBestEffort,
}));

import { DELETE } from "./route";

describe("DELETE /api/conversations/[conversationId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
    mocks.chatConversationDelete.mockResolvedValue(undefined);
    mocks.deleteLettaConversationBestEffort.mockResolvedValue(undefined);
  });

  it("deletes Letta conversation before removing the chat row when lettaConversationId is set", async () => {
    mocks.requireOwnedConversation.mockResolvedValue({
      id: "conv-1",
      profileId: "prof-1",
      lettaConversationId: "letta-thread-7",
    });

    const res = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ conversationId: "conv-1" }),
    });

    expect(res.status).toBe(204);
    expect(mocks.deleteLettaConversationBestEffort).toHaveBeenCalledWith("letta-thread-7");
    expect(mocks.chatConversationDelete).toHaveBeenCalledWith({ where: { id: "conv-1" } });

    const lettaOrder = mocks.deleteLettaConversationBestEffort.mock.invocationCallOrder[0]!;
    const dbOrder = mocks.chatConversationDelete.mock.invocationCallOrder[0]!;
    expect(lettaOrder).toBeLessThan(dbOrder);
  });

  it("skips Letta delete when lettaConversationId is absent", async () => {
    mocks.requireOwnedConversation.mockResolvedValue({
      id: "conv-2",
      profileId: "prof-1",
      lettaConversationId: null,
    });

    const res = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ conversationId: "conv-2" }),
    });

    expect(res.status).toBe(204);
    expect(mocks.deleteLettaConversationBestEffort).not.toHaveBeenCalled();
    expect(mocks.chatConversationDelete).toHaveBeenCalledWith({ where: { id: "conv-2" } });
  });
});
