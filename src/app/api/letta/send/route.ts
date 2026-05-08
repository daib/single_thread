import { NextResponse } from "next/server";
import { extractLettaAssistantText } from "@/lib/extractLettaAssistantText";
import { loadLettaEnvFile } from "@/lib/loadLettaEnvFile";

export const runtime = "nodejs";

loadLettaEnvFile();

/**
 * Sends text to a Letta agent and returns the assistant reply in JSON when configured.
 *
 * @see https://docs.letta.com/api/resources/agents/subresources/messages/methods/create/
 */
function summarizeLettaErrorBody(raw: string): string {
  const rawTrim = raw.trim();
  try {
    const j = JSON.parse(rawTrim) as Record<string, unknown>;
    if (typeof j.detail === "string") return j.detail.slice(0, 300);
    if (typeof j.message === "string") return j.message.slice(0, 300);
    if (Array.isArray(j.detail)) {
      const first = j.detail[0];
      if (first && typeof first === "object" && "msg" in first) {
        return String((first as { msg?: unknown }).msg ?? rawTrim).slice(0, 300);
      }
    }
  } catch {
    /* use raw text */
  }
  return rawTrim.slice(0, 400) || "(empty response body)";
}

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
      const detailRaw = await res.text();
      const hint = summarizeLettaErrorBody(detailRaw);
      console.error("[letta/send]", res.status, detailRaw.slice(0, 800));

      let summary = "Letta request failed.";
      if (res.status === 404) {
        summary = "Letta: agent not found — verify LETTA_AGENT_ID matches an agent on this server.";
      } else if (res.status === 401 || res.status === 403) {
        summary =
          "Letta: authentication failed — set LETTA_API_KEY (e.g. LETTA_SERVER_PASSWORD if SECURE=true).";
      } else if (res.status === 422 || res.status === 400) {
        summary = "Letta: rejected the request.";
      }

      return NextResponse.json(
        {
          error: summary,
          detail: hint,
          lettaStatus: res.status,
        },
        { status: 502 },
      );
    }

    let payload: unknown;
    try {
      payload = await res.json();
    } catch {
      return NextResponse.json({ error: "Letta returned non-JSON response." }, { status: 502 });
    }

    const reply = extractLettaAssistantText(payload);
    return NextResponse.json({ reply: reply ?? null });
  } catch (e) {
    console.error("[letta/send]", e);
    const detail = e instanceof Error ? e.message : String(e);
    const hint =
      /ECONNREFUSED|fetch failed/i.test(detail)
        ? "Connection refused — is Letta running (`docker compose up letta`) and is LETTA_BASE_URL correct (try http://127.0.0.1:8283)?"
        : detail.slice(0, 200);
    return NextResponse.json(
      { error: "Could not reach Letta server.", detail: hint, lettaStatus: 0 },
      { status: 503 },
    );
  }
}
