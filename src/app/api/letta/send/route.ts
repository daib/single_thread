import type { MessageCreate } from "@letta-ai/letta-client/resources/agents/agents";
import { APIConnectionError, APIError, Letta } from "@letta-ai/letta-client";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { resolveLettaAssistantReply } from "@/lib/resolveLettaAssistantReply";
import { loadLettaEnvFile } from "@/lib/loadLettaEnvFile";
import { requireOwnedProfile } from "@/lib/profileAccess";

export const runtime = "nodejs";

loadLettaEnvFile();

const LETTA_DEBUG_JSON_MAX = 24_000;

function jsonSnippet(value: unknown, maxChars: number): string {
  try {
    const s = JSON.stringify(value);
    if (s.length <= maxChars) return s;
    return `${s.slice(0, maxChars)} … [truncated, ${s.length} chars total]`;
  } catch {
    return String(value).slice(0, maxChars);
  }
}

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

  const profileIdRaw =
    typeof o.profileId === "string" ? o.profileId.trim() : "";

  let agentId: string | undefined;

  if (profileIdRaw) {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Sign in required to use a profile-scoped Letta agent." },
        { status: 401 },
      );
    }
    const profile = await requireOwnedProfile(profileIdRaw, session.user.id);
    if (!profile) {
      return NextResponse.json({ error: "Profile not found." }, { status: 404 });
    }
    agentId =
      profile.lettaAgentId?.trim() || process.env.LETTA_AGENT_ID?.trim();
  } else {
    agentId = process.env.LETTA_AGENT_ID?.trim();
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
      // Legacy / MemGPT agents: ask Letta to surface `send_message` tool calls as assistant messages in JSON.
      use_assistant_message: true,
    });

    console.log("[letta/send] Letta POST .../messages create response:", jsonSnippet(payload, LETTA_DEBUG_JSON_MAX));

    const reply = await resolveLettaAssistantReply(client, agentId, payload);
    if (reply == null && payload && typeof payload === "object") {
      const msgs = (payload as { messages?: unknown }).messages;
      console.warn("[letta/send] no assistant text after list fallback — create messages[]:");
      console.warn(jsonSnippet(msgs ?? [], LETTA_DEBUG_JSON_MAX));
      console.warn("[letta/send] full create response (truncated):");
      console.warn(jsonSnippet(payload, LETTA_DEBUG_JSON_MAX));
    }
    const emptyHint =
      reply == null
        ? "MemGPT-style agents only show text sent via the send_message tool. If the model stopped after inner monologue or another tool, there may be nothing user-visible — check Letta ADE / agent tools and server logs."
        : undefined;
    const responseBody = { reply: reply ?? null, ...(emptyHint ? { hint: emptyHint } : {}) };
    console.log("[letta/send] Next.js API response to client:", jsonSnippet(responseBody, 4_000));
    return NextResponse.json(responseBody);
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
