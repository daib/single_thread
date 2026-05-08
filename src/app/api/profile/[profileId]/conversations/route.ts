import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureChatLettaConversationId } from "@/lib/ensureChatLettaConversation";
import { forkLettaConversation } from "@/lib/lettaConversationApi";
import { mapConversation } from "@/lib/mapChatConversation";
import { prisma } from "@/lib/prisma";
import { requireOwnedProfile } from "@/lib/profileAccess";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ profileId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { profileId } = await context.params;
  if (!profileId) {
    return NextResponse.json({ error: "Missing profile id." }, { status: 400 });
  }

  const profile = await requireOwnedProfile(profileId, session.user.id);
  if (!profile) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  try {
    const rows = await prisma.chatConversation.findMany({
      where: { profileId },
      orderBy: { updatedAt: "desc" },
      include: {
        messages: { orderBy: { sentAt: "asc" } },
      },
    });
    const list = rows.map((c: (typeof rows)[number]) => mapConversation(c, profileId));
    return NextResponse.json(list);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Database error." }, { status: 503 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ profileId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { profileId } = await context.params;
  if (!profileId) {
    return NextResponse.json({ error: "Missing profile id." }, { status: 400 });
  }

  const profile = await requireOwnedProfile(profileId, session.user.id);
  if (!profile) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const o = json && typeof json === "object" ? (json as Record<string, unknown>) : {};
  const mode = typeof o.mode === "string" ? o.mode : "new";

  try {
    if (mode === "branch") {
      const fromId =
        typeof o.fromConversationId === "string" ? o.fromConversationId.trim() : "";
      if (!fromId) {
        return NextResponse.json({ error: "fromConversationId required." }, { status: 400 });
      }

      const source = await prisma.chatConversation.findFirst({
        where: { id: fromId, profileId },
        include: { messages: { orderBy: { sentAt: "asc" } } },
      });
      if (!source || source.messages.length === 0) {
        return NextResponse.json(
          { error: "Source conversation not found or empty." },
          { status: 400 },
        );
      }

      const truncated =
        source.title.length > 52 ? `${source.title.slice(0, 52)}…` : source.title;

      const created = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const newConv = await tx.chatConversation.create({
          data: {
            profileId,
            title: truncated,
            preview: source.preview || "",
            branchOfId: source.id,
          },
        });
        for (const m of source.messages) {
          await tx.chatMessage.create({
            data: {
              conversationId: newConv.id,
              role: m.role,
              body: m.body,
              sentAt: m.sentAt,
            },
          });
        }
        return tx.chatConversation.findUniqueOrThrow({
          where: { id: newConv.id },
          include: { messages: { orderBy: { sentAt: "asc" } } },
        });
      });

      const agentId =
        profile.lettaAgentId?.trim() || process.env.LETTA_AGENT_ID?.trim();
      if (source.lettaConversationId?.trim()) {
        const forked = await forkLettaConversation(source.lettaConversationId);
        if (forked.ok) {
          await prisma.chatConversation.update({
            where: { id: created.id },
            data: { lettaConversationId: forked.id },
          });
        } else if (agentId) {
          // Keep branch creation resilient when fork fails on older/limited servers.
          await ensureChatLettaConversationId(created.id, agentId);
        }
      } else if (agentId) {
        await ensureChatLettaConversationId(created.id, agentId);
      }

      return NextResponse.json(mapConversation(created, profileId), { status: 201 });
    }

    const title =
      typeof o.title === "string" && o.title.trim().length > 0
        ? o.title.trim().slice(0, 200)
        : "New chat";
    const preview =
      typeof o.preview === "string" && o.preview.trim().length > 0
        ? o.preview.trim().slice(0, 500)
        : "No messages yet";

    const conv = await prisma.chatConversation.create({
      data: {
        profileId,
        title,
        preview,
      },
      include: { messages: true },
    });

    const agentId =
      profile.lettaAgentId?.trim() || process.env.LETTA_AGENT_ID?.trim();
    if (agentId) {
      await ensureChatLettaConversationId(conv.id, agentId);
    }

    return NextResponse.json(mapConversation(conv, profileId), { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not create conversation." }, { status: 503 });
  }
}
