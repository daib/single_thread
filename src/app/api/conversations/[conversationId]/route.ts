import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { mapConversation } from "@/lib/mapChatConversation";
import { prisma } from "@/lib/prisma";
import { requireOwnedConversation } from "@/lib/profileAccess";

export const runtime = "nodejs";

const MAX_TITLE = 200;

export async function PATCH(
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

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const o = json && typeof json === "object" ? (json as Record<string, unknown>) : {};
  const rawTitle = typeof o.title === "string" ? o.title.trim() : "";
  const title = rawTitle.slice(0, MAX_TITLE);
  if (!title) {
    return NextResponse.json({ error: "Title is required." }, { status: 400 });
  }

  const conv = await requireOwnedConversation(conversationId, session.user.id);
  if (!conv) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  try {
    const updated = await prisma.chatConversation.update({
      where: { id: conversationId },
      data: { title },
      include: { messages: { orderBy: { sentAt: "asc" } } },
    });

    return NextResponse.json({
      conversation: mapConversation(updated, conv.profileId),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not update conversation." }, { status: 503 });
  }
}

export async function DELETE(
  _request: Request,
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

  try {
    await prisma.chatConversation.delete({ where: { id: conversationId } });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not delete conversation." }, { status: 503 });
  }
}
