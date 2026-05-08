import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createLettaAgentForProfile } from "@/lib/lettaCreateProfileAgent";
import { loadLettaEnvFile } from "@/lib/loadLettaEnvFile";
import { prisma } from "@/lib/prisma";

loadLettaEnvFile();

export const runtime = "nodejs";

const HANDLE_RE = /^[a-z0-9][a-z0-9_-]{1,30}$/;

function parseProfileBody(body: unknown): { displayName: string; handle: string; bio: string | null } | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const displayName = typeof o.displayName === "string" ? o.displayName.trim() : "";
  const handleRaw = typeof o.handle === "string" ? o.handle.trim().toLowerCase() : "";
  const bioRaw = typeof o.bio === "string" ? o.bio.trim() : "";
  if (!displayName || displayName.length > 120) return null;
  if (!HANDLE_RE.test(handleRaw)) return null;
  const bio = bioRaw.length === 0 ? null : bioRaw.slice(0, 2000);
  return { displayName, handle: handleRaw, bio };
}

export async function POST(
  request: Request,
  context: { params: Promise<{ accountId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { accountId } = await context.params;
  if (!accountId) {
    return NextResponse.json({ error: "Missing account id." }, { status: 400 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseProfileBody(json);
  if (!parsed) {
    return NextResponse.json(
      {
        error:
          "Invalid fields. displayName (1–120 chars) and handle (2–31 chars, lowercase letters, digits, _ and -) are required.",
      },
      { status: 400 },
    );
  }

  try {
    const account = await prisma.appAccount.findFirst({
      where: { id: accountId, userId: session.user.id },
      select: { id: true },
    });
    if (!account) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }

    const profile = await prisma.appProfile.create({
      data: {
        accountId,
        displayName: parsed.displayName,
        handle: parsed.handle,
        bio: parsed.bio,
      },
    });

    const lettaId = await createLettaAgentForProfile({
      displayName: parsed.displayName,
      profileId: profile.id,
    });
    const saved =
      lettaId != null
        ? await prisma.appProfile.update({
            where: { id: profile.id },
            data: { lettaAgentId: lettaId },
          })
        : profile;

    return NextResponse.json(saved, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json(
        { error: "That profile handle is already used on this account." },
        { status: 409 },
      );
    }
    console.error(e);
    return NextResponse.json(
      { error: "Could not create profile. Is the database running and migrated?" },
      { status: 503 },
    );
  }
}
