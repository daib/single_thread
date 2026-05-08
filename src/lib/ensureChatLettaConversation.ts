import { createLettaConversationForAgent } from "@/lib/lettaConversationApi";
import { prisma } from "@/lib/prisma";

export type EnsureLettaConversationResult =
  | { ok: true; id: string }
  | { ok: false; detail: string; status?: number };

/**
 * Ensure each app chat row has a persisted Letta conversation id.
 * Uses updateMany guard to avoid races creating duplicate ids.
 */
export async function ensureChatLettaConversationId(
  chatConversationId: string,
  agentId: string,
): Promise<EnsureLettaConversationResult> {
  const row = await prisma.chatConversation.findUnique({
    where: { id: chatConversationId },
    select: { lettaConversationId: true },
  });
  const existing = row?.lettaConversationId?.trim();
  if (existing) return { ok: true, id: existing };

  const created = await createLettaConversationForAgent(agentId);
  if (!created.ok) return created;

  await prisma.chatConversation.updateMany({
    where: { id: chatConversationId, lettaConversationId: null },
    data: { lettaConversationId: created.id },
  });

  const finalRow = await prisma.chatConversation.findUnique({
    where: { id: chatConversationId },
    select: { lettaConversationId: true },
  });
  const id = finalRow?.lettaConversationId?.trim();
  if (!id) {
    return {
      ok: false,
      detail: "Could not persist Letta conversation id.",
    };
  }
  return { ok: true, id };
}
