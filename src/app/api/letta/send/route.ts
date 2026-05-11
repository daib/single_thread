import type { MessageCreate } from "@letta-ai/letta-client/resources/agents/agents";
import { APIConnectionError, APIError, Letta } from "@letta-ai/letta-client";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureChatLettaConversationId } from "@/lib/ensureChatLettaConversation";
import {
  LettaHttpError,
  postLettaConversationMessageNonStreaming,
} from "@/lib/lettaConversationApi";
import { resolveLettaAssistantReply } from "@/lib/resolveLettaAssistantReply";
import { loadLettaEnvFile } from "@/lib/loadLettaEnvFile";
import { requireOwnedConversation, requireOwnedProfile } from "@/lib/profileAccess";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

loadLettaEnvFile();

const LETTA_DEBUG_JSON_MAX = 24_000;
const PROFILE_HISTORY_MAX_CHARS = 16_000;

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

function missingRequiredField(detailRaw: string, fieldName: string): boolean {
  if (!/field required/i.test(detailRaw)) return false;
  const escaped = fieldName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`['"]${escaped}['"]`, "i").test(detailRaw);
}

/**
 * Letta servers differ on user message shape: some require `text`, newer schema requires `content`.
 * Try modern `content` first, then retry `text` only when validation says `text` is required.
 */
async function sendAgentMessageCompatible(
  client: Letta,
  agentId: string,
  userText: string,
) {
  try {
    return await client.agents.messages.create(agentId, {
      messages: [
        {
          role: "user",
          content: userText,
        } as unknown as MessageCreate,
      ],
      streaming: false,
      use_assistant_message: true,
    });
  } catch (e) {
    if (!(e instanceof APIError) || e.status !== 422) throw e;
    const detailRaw = jsonErrorBodyForLog(e);
    if (!missingRequiredField(detailRaw, "text")) throw e;
    try {
      return await client.agents.messages.create(agentId, {
        messages: [
          {
            role: "user",
            text: userText,
          } as unknown as MessageCreate,
        ],
        streaming: false,
        use_assistant_message: true,
      });
    } catch (e2) {
      // Some Letta builds report missing `text` then reject with missing `content`.
      // Retry the original `content` payload once and, if it still fails, bubble the original error.
      if (e2 instanceof APIError && e2.status === 422) {
        const detail2 = jsonErrorBodyForLog(e2);
        if (missingRequiredField(detail2, "content")) {
          try {
            return await client.agents.messages.create(agentId, {
              messages: [
                {
                  role: "user",
                  content: userText,
                } as unknown as MessageCreate,
              ],
              streaming: false,
              use_assistant_message: true,
            });
          } catch {
            throw e;
          }
        }
      }
      throw e2;
    }
  }
}

function trimHistoryTail(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(text.length - maxChars);
}

async function buildConversationHistoryContext(conversationId: string): Promise<string | null> {
  const conv = await prisma.chatConversation.findUnique({
    where: { id: conversationId },
    include: { messages: { orderBy: { sentAt: "asc" } } },
  });
  if (!conv || conv.messages.length === 0) return null;

  const lines: string[] = [`Conversation: ${conv.title}`];
  for (const m of conv.messages) {
    lines.push(`${m.role === "assistant" ? "Assistant" : "User"}: ${m.body}`);
  }

  const maxCharsRaw = Number.parseInt(
    process.env.LETTA_PROFILE_HISTORY_MAX_CHARS?.trim() ?? "",
    10,
  );
  const maxChars =
    Number.isFinite(maxCharsRaw) && maxCharsRaw > 500
      ? maxCharsRaw
      : PROFILE_HISTORY_MAX_CHARS;
  const bounded = trimHistoryTail(lines.join("\n"), maxChars);
  return [
    "Background from this conversation thread (most recent tail):",
    bounded,
  ].join("\n");
}

function withSendMessageNudge(text: string): string {
  return `${text}\n\n[Instruction for agent: respond to the user by calling send_message with your full answer. Do not end the turn without a user-visible message.]`;
}

function isAgentMissingError(lettaStatus: number, detail: string): boolean {
  if (lettaStatus === 404) return true;
  if (lettaStatus === 500 && /agent does not exist|agent not found/i.test(detail)) return true;
  return false;
}

/** MemGPT compaction tried to summarize but the in-memory thread had ≤1 eligible message (common on early turns or huge single messages). */
function isSummarizeTooFewMessagesError(lettaStatus: number, detail: string): boolean {
  if (lettaStatus !== 500) return false;
  return /couldn'?t find enough messages to compress|len=\d+\s*<=\s*1/i.test(detail);
}

function isConversationStepSignatureError(lettaStatus: number, detail: string): boolean {
  if (lettaStatus !== 500) return false;
  return /unexpected keyword argument ['"]conversation_id['"]/i.test(detail);
}

function isUnknownLettaServerError(lettaStatus: number, detail: string): boolean {
  if (lettaStatus !== 500) return false;
  return /unknown error occurred/i.test(detail);
}

function lettaErrorResponse(lettaStatus: number, detail: string) {
  let summary = "Letta request failed.";
  if (isAgentMissingError(lettaStatus, detail)) {
    summary =
      "Letta: no agent with this id — set LETTA_AGENT_ID to an existing agent (Letta ADE, or `GET /v1/agents` against this server).";
  } else if (isSummarizeTooFewMessagesError(lettaStatus, detail)) {
    summary =
      "Letta: summarization/compaction failed because the thread had too few messages to compress (often the first turn or one very large message). Retry, upgrade the Letta server, or tune compaction in server config.";
  } else if (isConversationStepSignatureError(lettaStatus, detail)) {
    summary =
      "Letta: server build mismatch in conversation runtime (`conversation_id` passed to an incompatible `step()` signature). Update/rebuild Letta so routers and runtime are on the same version.";
  } else if (isUnknownLettaServerError(lettaStatus, detail)) {
    summary =
      "Letta: internal server error with no detail. Check Letta container logs and verify request payload compatibility for your server build. If this only affects conversation-thread sends, compare with agent-message sends to isolate the mismatch.";
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
  const startedAtMs = Date.now();
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
  const appConversationIdRaw =
    typeof o.conversationId === "string" ? o.conversationId.trim() : "";
  if (appConversationIdRaw && !profileIdRaw) {
    return NextResponse.json(
      { error: "conversationId requires profileId." },
      { status: 400 },
    );
  }

  let agentId: string | undefined;
  let outboundUserText = bodyText;
  let lettaConversationId: string | undefined;

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

    if (appConversationIdRaw) {
      const appConv = await requireOwnedConversation(
        appConversationIdRaw,
        session.user.id,
      );
      if (!appConv || appConv.profileId !== profileIdRaw) {
        return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
      }
      if (!agentId) {
        return new NextResponse(null, { status: 204 });
      }
      const ensured = await ensureChatLettaConversationId(appConversationIdRaw, agentId);
      if (!ensured.ok) {
        return NextResponse.json(
          {
            error: "Letta: could not create/find a server conversation for this chat.",
            detail: ensured.detail,
            ...(ensured.status != null ? { lettaStatus: ensured.status } : {}),
          },
          { status: 503 },
        );
      }
      lettaConversationId = ensured.id;
    }
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
    const usedConversationThread = Boolean(lettaConversationId);
    let effectiveOutboundUserText = outboundUserText;
    if (!usedConversationThread && appConversationIdRaw) {
      try {
        const threadHistory = await buildConversationHistoryContext(appConversationIdRaw);
        if (threadHistory) {
          effectiveOutboundUserText = `${threadHistory}\n\nCurrent user message:\n${bodyText}`;
        }
      } catch (e) {
        console.warn("[letta/send] could not build conversation history context:", e);
      }
    }
    let currentTurnUserText = withSendMessageNudge(effectiveOutboundUserText);
    let payload: unknown;
    if (usedConversationThread && lettaConversationId) {
      try {
        payload = await postLettaConversationMessageNonStreaming(
          lettaConversationId,
          currentTurnUserText,
        );
      } catch (e) {
        if (e instanceof LettaHttpError && e.status >= 500) {
          // Strict mode: do not fall back to agent/default conversation when a per-chat conversation send fails.
          throw e;
        } else {
          throw e;
        }
      }
    } else {
      payload = await sendAgentMessageCompatible(
        client,
        agentId,
        currentTurnUserText,
      );
    }

    console.log(
      usedConversationThread
        ? "[letta/send] Letta POST .../conversations/.../messages response:"
        : "[letta/send] Letta POST .../messages create response:",
      jsonSnippet(payload, LETTA_DEBUG_JSON_MAX),
    );

    const reply = await resolveLettaAssistantReply(client, agentId, payload, {
      currentUserText: currentTurnUserText,
      startedAtMs,
      conversationLettaId: usedConversationThread ? lettaConversationId : undefined,
    });
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
    if (e instanceof LettaHttpError) {
      const hint = summarizeLettaErrorBody(e.message);
      console.error("[letta/send]", e.status, e.message.slice(0, 800));
      return lettaErrorResponse(e.status, hint);
    }
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
