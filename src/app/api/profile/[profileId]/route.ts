import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireOwnedProfile } from "@/lib/profileAccess";

export const runtime = "nodejs";

export async function DELETE(
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
    await prisma.appProfile.delete({ where: { id: profileId } });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not delete profile." }, { status: 503 });
  }
}
