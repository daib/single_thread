import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

async function requireSession() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  return null;
}

const HANDLE_RE = /^[a-z0-9][a-z0-9_-]{1,30}$/;

function parseBody(body: unknown): { displayName: string; handle: string; bio: string | null } | null {
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

export async function GET() {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  try {
    const profiles = await prisma.profile.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(profiles);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Database unavailable. Check DATABASE_URL and that Postgres is running." },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseBody(json);
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
    const profile = await prisma.profile.create({
      data: {
        displayName: parsed.displayName,
        handle: parsed.handle,
        bio: parsed.bio,
      },
    });
    return NextResponse.json(profile, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "That handle is already taken." }, { status: 409 });
    }
    console.error(e);
    return NextResponse.json(
      { error: "Could not create profile. Is the database running and migrated?" },
      { status: 503 },
    );
  }
}
