import type { ChatConversation as DbConv, ChatMessage as DbMsg } from "@prisma/client";
import type { Conversation, Message } from "@/types";

export function mapMessage(m: DbMsg): Message {
  return {
    id: m.id,
    role: m.role === "assistant" ? "assistant" : "user",
    body: m.body,
    sentAt: m.sentAt.toISOString(),
  };
}

export function mapConversation(
  conv: DbConv & { messages: DbMsg[] },
  profileId: string,
): Conversation {
  const messages = [...conv.messages].sort(
    (a, b) => a.sentAt.getTime() - b.sentAt.getTime(),
  );
  return {
    id: conv.id,
    profileId,
    branchOfId: conv.branchOfId ?? undefined,
    title: conv.title,
    preview:
      conv.preview ||
      (messages.length === 0 ? "No messages yet" : messages[messages.length - 1]!.body.slice(0, 120)),
    updatedAt: conv.updatedAt.toISOString(),
    messages: messages.map(mapMessage),
  };
}
