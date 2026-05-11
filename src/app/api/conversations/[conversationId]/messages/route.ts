import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getLastAssistantBeforeTrailingUser,
  messagesBodiesDuplicate,
} from "@/lib/lettaAssistantDedupe";
import { mapConversation, mapMessage } from "@/lib/mapChatConversation";
import { prisma } from "@/lib/prisma";
import { requireOwnedConversation } from "@/lib/profileAccess";
import type { Message } from "@/types";

export const runtime = "nodejs";

const MAX_BODY = 32000;

function parseMessageBody(body: unknown): { role: "user" | "assistant"; body: string } | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const roleRaw = o.role === "assistant" ? "assistant" : o.role === "user" ? "user" : null;
  const text = typeof o.body === "string" ? o.body.trim() : "";
  if (!roleRaw || !text || text.length > MAX_BODY) return null;
  return { role: roleRaw, body: text };
}

export async function POST(
  request: Request,
  context: { params: Promise<{ conversationId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { conversationId } = await context.params;
  if (!conversationId) {
    return NextResponse.json({ error: "Missing conversation id." }, { status: 400 });
  }

  const conv = await requireOwnedConversation(conversationId, session.user.id);
  if (!conv) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseMessageBody(json);
  if (!parsed) {
    return NextResponse.json(
      { error: "Invalid body. Require role: user|assistant and body (non-empty text)." },
      { status: 400 },
    );
  }

  const profileId = conv.profileId;

  try {
    const before = await prisma.chatConversation.findUnique({
      where: { id: conversationId },
      include: { messages: { orderBy: { sentAt: "asc" } } },
    });
    if (!before) {
      return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    }

    const wasEmpty = before.messages.length === 0;

    if (parsed.role === "assistant") {
      const uiMessages: Message[] = before.messages.map(mapMessage);
      const priorAssist = getLastAssistantBeforeTrailingUser(uiMessages);
      if (
        priorAssist != null &&
        messagesBodiesDuplicate(priorAssist, parsed.body) &&
        uiMessages.length > 0 &&
        uiMessages[uiMessages.length - 1].role === "user"
      ) {
        const full = await prisma.chatConversation.findUniqueOrThrow({
          where: { id: conversationId },
          include: { messages: { orderBy: { sentAt: "asc" } } },
        });
        return NextResponse.json({
          conversation: mapConversation(full, profileId),
        });
      }
    }

    await prisma.chatMessage.create({
      data: {
        conversationId,
        role: parsed.role,
        body: parsed.body,
      },
    });

    let title = before.title;
    if (
      parsed.role === "user" &&
      wasEmpty &&
      before.title === "New chat" &&
      parsed.body.length > 0
    ) {
      title =
        parsed.body.length > 48 ? `${parsed.body.slice(0, 48)}…` : parsed.body;
    }

    const preview =
      parsed.role === "user"
        ? parsed.body.slice(0, 500)
        : parsed.body.slice(0, 500);

    await prisma.chatConversation.update({
      where: { id: conversationId },
      data: {
        title,
        preview,
      },
    });

    const full = await prisma.chatConversation.findUniqueOrThrow({
      where: { id: conversationId },
      include: { messages: { orderBy: { sentAt: "asc" } } },
    });

    return NextResponse.json({
      conversation: mapConversation(full, profileId),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not add message." }, { status: 503 });
  }
}
