// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  requireOwnedProfile: vi.fn(),
  findMany: vi.fn(),
  appProfileDelete: vi.fn(),
  deleteLettaConversationBestEffort: vi.fn(),
  deleteLettaAgentById: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: mocks.auth,
}));

vi.mock("@/lib/profileAccess", () => ({
  requireOwnedProfile: mocks.requireOwnedProfile,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    chatConversation: { findMany: mocks.findMany },
    appProfile: { delete: mocks.appProfileDelete },
  },
}));

vi.mock("@/lib/lettaConversationApi", () => ({
  deleteLettaConversationBestEffort: mocks.deleteLettaConversationBestEffort,
}));

vi.mock("@/lib/lettaCreateProfileAgent", () => ({
  deleteLettaAgentById: mocks.deleteLettaAgentById,
}));

import { DELETE } from "./route";

describe("DELETE /api/profile/[profileId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
    mocks.requireOwnedProfile.mockResolvedValue({
      id: "prof-1",
      lettaAgentId: "agent-99",
    });
    mocks.findMany.mockResolvedValue([
      { lettaConversationId: "letta-c-1" },
      { lettaConversationId: "letta-c-2" },
      { lettaConversationId: "letta-c-1" },
    ]);
    mocks.appProfileDelete.mockResolvedValue(undefined);
    mocks.deleteLettaConversationBestEffort.mockResolvedValue(undefined);
    mocks.deleteLettaAgentById.mockResolvedValue(undefined);
  });

  it("deletes each unique Letta conversation, then the profile, then the Letta agent", async () => {
    const res = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ profileId: "prof-1" }),
    });

    expect(res.status).toBe(204);
    expect(mocks.findMany).toHaveBeenCalledWith({
      where: { profileId: "prof-1" },
      select: { lettaConversationId: true },
    });
    expect(mocks.deleteLettaConversationBestEffort).toHaveBeenCalledTimes(2);
    expect(mocks.deleteLettaConversationBestEffort).toHaveBeenCalledWith("letta-c-1");
    expect(mocks.deleteLettaConversationBestEffort).toHaveBeenCalledWith("letta-c-2");
    expect(mocks.appProfileDelete).toHaveBeenCalledWith({ where: { id: "prof-1" } });
    expect(mocks.deleteLettaAgentById).toHaveBeenCalledWith("agent-99");

    const convOrder = mocks.deleteLettaConversationBestEffort.mock.invocationCallOrder[0]!;
    const profileOrder = mocks.appProfileDelete.mock.invocationCallOrder[0]!;
    const agentOrder = mocks.deleteLettaAgentById.mock.invocationCallOrder[0]!;
    expect(convOrder).toBeLessThan(profileOrder);
    expect(profileOrder).toBeLessThan(agentOrder);
  });

  it("does not call deleteLettaConversationBestEffort when no Letta conversation ids", async () => {
    mocks.findMany.mockResolvedValue([
      { lettaConversationId: null },
      { lettaConversationId: "   " },
    ]);

    const res = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ profileId: "prof-1" }),
    });

    expect(res.status).toBe(204);
    expect(mocks.deleteLettaConversationBestEffort).not.toHaveBeenCalled();
    expect(mocks.appProfileDelete).toHaveBeenCalled();
  });

  it("does not call deleteLettaAgentById when profile has no Letta agent", async () => {
    mocks.requireOwnedProfile.mockResolvedValue({
      id: "prof-1",
      lettaAgentId: null,
    });
    mocks.findMany.mockResolvedValue([]);

    const res = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ profileId: "prof-1" }),
    });

    expect(res.status).toBe(204);
    expect(mocks.deleteLettaAgentById).not.toHaveBeenCalled();
  });
});
