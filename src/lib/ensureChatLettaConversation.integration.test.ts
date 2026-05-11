import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/lettaConversationApi", () => ({
  createLettaConversationForAgent: vi.fn(),
}));

import { createLettaConversationForAgent } from "@/lib/lettaConversationApi";
import { ensureChatLettaConversationId } from "@/lib/ensureChatLettaConversation";
import { prisma } from "@/lib/prisma";

describe("ensureChatLettaConversationId (database)", () => {
  beforeEach(() => {
    vi.mocked(createLettaConversationForAgent).mockReset();
  });

  async function seedConversation() {
    const account = await prisma.appAccount.create({
      data: {
        userId: "u-1",
        handle: "acc-handle",
        displayName: "Acc",
      },
    });
    const profile = await prisma.appProfile.create({
      data: {
        accountId: account.id,
        displayName: "Prof",
        handle: "prof-h",
      },
    });
    return prisma.chatConversation.create({
      data: {
        profileId: profile.id,
        title: "Chat",
        preview: "",
        lettaConversationId: null,
      },
    });
  }

  it("returns existing letta id without calling Letta API", async () => {
    const conv = await seedConversation();
    await prisma.chatConversation.update({
      where: { id: conv.id },
      data: { lettaConversationId: "already-set" },
    });
    const result = await ensureChatLettaConversationId(conv.id, "agent-1");
    expect(result).toEqual({ ok: true, id: "already-set" });
    expect(createLettaConversationForAgent).not.toHaveBeenCalled();
  });

  it("creates via API, persists id, and returns it", async () => {
    vi.mocked(createLettaConversationForAgent).mockResolvedValue({
      ok: true,
      id: "letta-new-id",
    });
    const conv = await seedConversation();
    const result = await ensureChatLettaConversationId(conv.id, "agent-z");
    expect(result).toEqual({ ok: true, id: "letta-new-id" });
    expect(createLettaConversationForAgent).toHaveBeenCalledWith("agent-z");
    const row = await prisma.chatConversation.findUnique({
      where: { id: conv.id },
      select: { lettaConversationId: true },
    });
    expect(row?.lettaConversationId).toBe("letta-new-id");
  });

  it("propagates Letta API failure without writing id", async () => {
    vi.mocked(createLettaConversationForAgent).mockResolvedValue({
      ok: false,
      detail: "upstream error",
      status: 503,
    });
    const conv = await seedConversation();
    const result = await ensureChatLettaConversationId(conv.id, "agent-x");
    expect(result).toEqual({ ok: false, detail: "upstream error", status: 503 });
    const row = await prisma.chatConversation.findUnique({
      where: { id: conv.id },
      select: { lettaConversationId: true },
    });
    expect(row?.lettaConversationId).toBeNull();
  });
});
