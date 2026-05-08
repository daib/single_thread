import { NextResponse } from "next/server";
import { reconcileLettaAgentsWithProfiles } from "@/lib/reconcileLettaAgents";

export const runtime = "nodejs";

/**
 * Deletes orphan Letta agents (not tied to a profile and not in env keep lists).
 * If `CRON_SECRET` is set, requires `Authorization: Bearer <CRON_SECRET>`.
 * If unset, the route is open — lock down before exposing publicly.
 *
 * `curl -X POST https://host/api/cron/reconcile-letta-agents`
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
  }

  try {
    const result = await reconcileLettaAgentsWithProfiles();
    console.log("[reconcile-letta-agents]", result);
    return NextResponse.json(result);
  } catch (e) {
    console.error("[reconcile-letta-agents]", e);
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
