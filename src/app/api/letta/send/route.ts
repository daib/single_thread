import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Forwards the user's message to a Letta agent (self-hosted or cloud).
 * Set LETTA_AGENT_ID to enable; otherwise returns 204 and does nothing.
 *
 * @see https://docs.letta.com/api/resources/agents/subresources/messages/methods/create/
 */
export async function POST(request: Request) {
  const agentId = process.env.LETTA_AGENT_ID?.trim();
  const baseRaw = process.env.LETTA_BASE_URL?.trim() || "http://127.0.0.1:8283";
  const base = baseRaw.replace(/\/$/, "");

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const o = json && typeof json === "object" ? (json as Record<string, unknown>) : {};
  const bodyText = typeof o.body === "string" ? o.body.trim() : "";
  if (!bodyText) {
    return NextResponse.json({ error: "Non-empty body string required." }, { status: 400 });
  }

  if (!agentId) {
    return new NextResponse(null, { status: 204 });
  }

  const url = `${base}/v1/agents/${encodeURIComponent(agentId)}/messages`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const apiKey = process.env.LETTA_API_KEY?.trim();
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        input: bodyText,
        streaming: false,
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error("[letta/send]", res.status, detail.slice(0, 800));
      return NextResponse.json(
        { error: "Letta request failed.", status: res.status },
        { status: 502 },
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (e) {
    console.error("[letta/send]", e);
    return NextResponse.json({ error: "Could not reach Letta server." }, { status: 503 });
  }
}
