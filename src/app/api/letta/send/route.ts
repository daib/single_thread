import type { MessageCreate } from "@letta-ai/letta-client/resources/agents/agents";
import { APIConnectionError, APIError, Letta } from "@letta-ai/letta-client";
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

function jsonErrorBodyForLog(err: APIError): string {
  try {
    return JSON.stringify(err.error);
  } catch {
    return err.message;
  }
}

function isAgentMissingError(lettaStatus: number, detail: string): boolean {
  if (lettaStatus === 404) return true;
  if (lettaStatus === 500 && /agent does not exist|agent not found/i.test(detail)) return true;
  return false;
}

function lettaErrorResponse(lettaStatus: number, detail: string) {
  let summary = "Letta request failed.";
  if (isAgentMissingError(lettaStatus, detail)) {
    summary =
      "Letta: no agent with this id — set LETTA_AGENT_ID to an existing agent (Letta ADE, or `GET /v1/agents` against this server).";
  } else if (lettaStatus === 401 || lettaStatus === 403) {
    summary =
      "Letta: authentication failed — set LETTA_API_KEY (e.g. LETTA_SERVER_PASSWORD if SECURE=true).";
  } else if (lettaStatus === 422 || lettaStatus === 400) {
    summary = "Letta: rejected the request.";
  }

  return NextResponse.json(
    {
      error: summary,
      detail,
      lettaStatus,
    },
    { status: 502 },
  );
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

  const client = new Letta({
    baseURL: base,
    apiKey: process.env.LETTA_API_KEY?.trim() || null,
  });

  try {
    // Self-hosted Letta (Docker image) validates user messages with `text`; `content` is rejected (422).
    const payload = await client.agents.messages.create(agentId, {
      messages: [
        {
          role: "user",
          text: bodyText,
        } as unknown as MessageCreate,
      ],
      streaming: false,
    });

    const reply = extractLettaAssistantText(payload);
    return NextResponse.json({ reply: reply ?? null });
  } catch (e) {
    if (e instanceof APIError) {
      const detailRaw = jsonErrorBodyForLog(e);
      const hint = summarizeLettaErrorBody(detailRaw);
      console.error("[letta/send]", e.status, detailRaw.slice(0, 800));
      return lettaErrorResponse(e.status, hint);
    }

    console.error("[letta/send]", e);
    const isConn =
      e instanceof APIConnectionError ||
      (e instanceof Error && /ECONNREFUSED|fetch failed/i.test(e.message));
    const detail = e instanceof Error ? e.message : String(e);
    const hint = isConn
      ? "Connection refused — is Letta running (`docker compose up letta`) and is LETTA_BASE_URL correct (try http://127.0.0.1:8283)?"
      : detail.slice(0, 200);
    return NextResponse.json(
      { error: "Could not reach Letta server.", detail: hint, lettaStatus: 0 },
      { status: 503 },
    );
  }
}
