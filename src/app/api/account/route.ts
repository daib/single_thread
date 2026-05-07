import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

async function requireUserId(): Promise<{ userId: string } | NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  return { userId: session.user.id };
}

const HANDLE_RE = /^[a-z0-9][a-z0-9_-]{1,30}$/;

function parseAccountBody(body: unknown): { displayName: string; handle: string; bio: string | null } | null {
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

function uniqueConflictMessage(e: Prisma.PrismaClientKnownRequestError): string | null {
  if (e.code !== "P2002") return null;
  const target = e.meta?.target;
  if (!Array.isArray(target)) return null;
    if (target.includes("user_id") || target.includes("userId")) return "You already have an account.";
    if (target.includes("handle")) return "That account handle is already taken.";
  return null;
}

export async function GET() {
  const authResult = await requireUserId();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  try {
    const accounts = await prisma.appAccount.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        profiles: { orderBy: { createdAt: "desc" } },
      },
    });
    return NextResponse.json(accounts);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Database unavailable. Check DATABASE_URL and that Postgres is running." },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  const authResult = await requireUserId();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseAccountBody(json);
  if (!parsed) {
    return NextResponse.json(
      {
        error:
          "Invalid fields. displayName (1–120 chars) and handle (2–31 chars, lowercase letters, digits, _ and -) are required. bio is optional (max 2000 chars).",
      },
      { status: 400 },
    );
  }

  const existing = await prisma.appAccount.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ error: "You already have an account." }, { status: 409 });
  }

  try {
    const account = await prisma.appAccount.create({
      data: {
        userId,
        displayName: parsed.displayName,
        handle: parsed.handle,
        bio: parsed.bio,
      },
    });
    return NextResponse.json(account, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      const msg = uniqueConflictMessage(e);
      if (msg) return NextResponse.json({ error: msg }, { status: 409 });
    }
    console.error(e);
    return NextResponse.json(
      { error: "Could not create account. Is the database running and migrated?" },
      { status: 503 },
    );
  }
}
