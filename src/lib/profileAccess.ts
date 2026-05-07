import { prisma } from "@/lib/prisma";

/** Ensures the profile exists and belongs to the signed-in Auth.js user (via account.userId). */
export async function requireOwnedProfile(profileId: string, userId: string) {
  const profile = await prisma.appProfile.findFirst({
    where: { id: profileId },
    include: { account: { select: { userId: true } } },
  });
  if (!profile || profile.account.userId !== userId) {
    return null;
  }
  return profile;
}

export async function requireOwnedConversation(conversationId: string, userId: string) {
  const conv = await prisma.chatConversation.findFirst({
    where: { id: conversationId },
    include: {
      profile: {
        include: { account: { select: { userId: true } } },
      },
    },
  });
  if (!conv || conv.profile.account.userId !== userId) {
    return null;
  }
  return conv;
}
