import type { Letta } from "@letta-ai/letta-client";
import { coerceToMessagesArray, extractLettaAssistantText } from "@/lib/extractLettaAssistantText";
import {
  hydrateLettaResponseMessages,
  payloadHasStubMessages,
} from "@/lib/hydrateLettaResponseMessages";

/**
 * Parse assistant text from create response; hydrate stubs; if still empty, list agent messages
 * (self‑hosted often returns only `{ id, date }` on create — full bodies show up on list).
 */
export async function resolveLettaAssistantReply(
  client: Letta,
  agentId: string,
  createPayload: unknown,
  opts?: { currentUserText?: string; startedAtMs?: number },
): Promise<string | null> {
  let toParse: unknown = createPayload;
  if (payloadHasStubMessages(createPayload)) {
    toParse = await hydrateLettaResponseMessages(client, createPayload, agentId);
  }

  let reply = extractLettaAssistantText(toParse);
  if (reply != null) return reply;

  try {
    const page = await client.agents.messages.list(agentId, { limit: 80 });
    // Docker Letta may return `{ "messages": [...] }` while the SDK ArrayPage stores that object on `items`.
    let rows = coerceToMessagesArray(page.items as unknown);
    if (rows.length === 0) {
      rows = coerceToMessagesArray(page as unknown);
    }

    rows = constrainRowsToCurrentTurn(rows, opts);

    let listPayload: unknown = { messages: rows };
    if (payloadHasStubMessages(listPayload)) {
      listPayload = await hydrateLettaResponseMessages(client, listPayload, agentId);
    }

    reply = extractLettaAssistantText(listPayload);
    if (reply != null) return reply;

    console.warn(
      "[letta/send] list fallback still empty; row count:",
      rows.length,
      "first keys:",
      rows[0] && typeof rows[0] === "object"
        ? Object.keys(rows[0] as object).slice(0, 20).join(", ")
        : typeof rows[0],
    );
  } catch (e) {
    console.warn("[letta/send] agents.messages.list fallback failed:", e);
  }

  return null;
}

function constrainRowsToCurrentTurn(
  rows: unknown[],
  opts?: { currentUserText?: string; startedAtMs?: number },
): unknown[] {
  if (rows.length === 0) return rows;

  const currentText = (opts?.currentUserText ?? "").trim();
  if (currentText) {
    const target = normalize(currentText);
    for (let i = rows.length - 1; i >= 0; i--) {
      const r = rows[i];
      if (!r || typeof r !== "object") continue;
      const msg = r as Record<string, unknown>;
      if (!isUserMessage(msg)) continue;
      const text = userTextFromRow(msg);
      if (!text) continue;
      if (normalize(text) === target) {
        return rows.slice(i);
      }
    }
  }

  const startedAtMs = opts?.startedAtMs;
  if (startedAtMs && Number.isFinite(startedAtMs)) {
    const floor = startedAtMs - 15_000;
    const recent = rows.filter((r) => {
      if (!r || typeof r !== "object") return false;
      const msg = r as Record<string, unknown>;
      const ms = messageTimeMs(msg);
      return ms != null && ms >= floor;
    });
    if (recent.length > 0) return recent;
  }

  return [];
}

function isUserMessage(msg: Record<string, unknown>): boolean {
  const mt = typeof msg.message_type === "string" ? msg.message_type.toLowerCase() : "";
  if (mt === "user_message") return true;
  return msg.role === "user";
}

function userTextFromRow(msg: Record<string, unknown>): string | null {
  if (typeof msg.text === "string" && msg.text.trim()) return msg.text;
  if (typeof msg.body === "string" && msg.body.trim()) return msg.body;
  if (typeof msg.message === "string" && msg.message.trim()) return msg.message;
  const c = msg.content;
  if (typeof c === "string" && c.trim()) return c;
  if (Array.isArray(c)) {
    const parts = c
      .map((p) => {
        if (typeof p === "string") return p;
        if (p && typeof p === "object") {
          const t = (p as Record<string, unknown>).text;
          if (typeof t === "string") return t;
        }
        return "";
      })
      .join(" ")
      .trim();
    if (parts) return parts;
  }
  return null;
}

function normalize(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function messageTimeMs(msg: Record<string, unknown>): number | null {
  for (const k of ["date", "created_at", "updated_at"]) {
    const v = msg[k];
    if (typeof v === "string") {
      const ms = Date.parse(v);
      if (!Number.isNaN(ms)) return ms;
    }
  }
  return null;
}
