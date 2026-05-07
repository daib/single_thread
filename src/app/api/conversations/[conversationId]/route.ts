import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireOwnedConversation } from "@/lib/profileAccess";

export const runtime = "nodejs";

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
