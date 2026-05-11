import { describe, expect, it } from "vitest";
import { requireOwnedConversation, requireOwnedProfile } from "@/lib/profileAccess";
import { prisma } from "@/lib/prisma";

async function seedUserGraph(userId: string) {
  const account = await prisma.appAccount.create({
    data: {
      userId,
      handle: `h-${userId.slice(0, 8)}`,
      displayName: "Account",
    },
  });
  const profile = await prisma.appProfile.create({
    data: {
      accountId: account.id,
      displayName: "Profile",
      handle: "profile-handle",
    },
  });
  const conversation = await prisma.chatConversation.create({
    data: {
      profileId: profile.id,
      title: "Thread",
      preview: "",
    },
  });
  return { account, profile, conversation };
}

describe("profileAccess (database)", () => {
  it("requireOwnedProfile returns profile when user owns it", async () => {
    const { profile } = await seedUserGraph("user-a");
    const got = await requireOwnedProfile(profile.id, "user-a");
    expect(got).not.toBeNull();
    expect(got!.id).toBe(profile.id);
    expect(got!.account.userId).toBe("user-a");
  });

  it("requireOwnedProfile returns null for wrong user", async () => {
    const { profile } = await seedUserGraph("user-owner");
    expect(await requireOwnedProfile(profile.id, "user-intruder")).toBeNull();
  });

  it("requireOwnedProfile returns null when profile id does not exist", async () => {
    expect(await requireOwnedProfile("nonexistent-profile-id", "user-a")).toBeNull();
  });

  it("requireOwnedConversation returns conversation when user owns it", async () => {
    const { conversation } = await seedUserGraph("user-b");
    const got = await requireOwnedConversation(conversation.id, "user-b");
    expect(got).not.toBeNull();
    expect(got!.id).toBe(conversation.id);
    expect(got!.profile.account.userId).toBe("user-b");
  });

  it("requireOwnedConversation returns null for wrong user", async () => {
    const { conversation } = await seedUserGraph("user-owner");
    expect(await requireOwnedConversation(conversation.id, "other")).toBeNull();
  });

  it("requireOwnedConversation returns null when id does not exist", async () => {
    expect(await requireOwnedConversation("missing-conv", "user-c")).toBeNull();
  });
});
