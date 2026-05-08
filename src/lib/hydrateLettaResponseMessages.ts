import type { Letta } from "@letta-ai/letta-client";
import { APIError } from "@letta-ai/letta-client";

/** Non-streaming create sometimes returns placeholder rows with only `id` + `date`; load full bodies from `/v1/messages/{id}`. */
export function payloadHasStubMessages(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") return false;
  const msgs = (payload as { messages?: unknown }).messages;
  if (!Array.isArray(msgs)) return false;
  return msgs.some(isStubOnlyLettaMessage);
}

export function isStubOnlyLettaMessage(msg: unknown): boolean {
  if (!msg || typeof msg !== "object") return false;
  const m = msg as Record<string, unknown>;
  if (typeof m.id !== "string") return false;
  const keysWithValues = Object.keys(m).filter((k) => m[k] != null && m[k] !== "");
  return keysWithValues.every((k) => k === "id" || k === "date");
}

async function fetchMessageById(client: Letta, agentId: string | undefined, id: string): Promise<unknown | null> {
  try {
    const raw = await client.messages.retrieve(id);
    const full = Array.isArray(raw) ? raw[0] : raw;
    if (full && typeof full === "object") return full;
  } catch (e) {
    const is404 = e instanceof APIError && e.status === 404;
    if (agentId && is404) {
      try {
        const scoped = await client.get(
          `/v1/agents/${encodeURIComponent(agentId)}/messages/${encodeURIComponent(id)}`,
        );
        const body = await scoped;
        if (body && typeof body === "object") return body;
      } catch {
        /* fall through */
      }
    }
    if (!is404) {
      console.warn("[letta/send] messages.retrieve failed for", id, e);
    }
  }
  return null;
}

export async function hydrateLettaResponseMessages(
  client: Letta,
  payload: unknown,
  agentId?: string,
): Promise<unknown> {
  if (!payload || typeof payload !== "object") return payload;
  const root = payload as Record<string, unknown>;
  const msgs = root.messages;
  if (!Array.isArray(msgs)) return payload;

  const cache = new Map<string, unknown>();
  const next: unknown[] = [];

  for (const entry of msgs) {
    if (!entry || typeof entry !== "object") {
      next.push(entry);
      continue;
    }
    const msg = entry as Record<string, unknown>;
    const id = typeof msg.id === "string" ? msg.id : null;
    if (!id || !isStubOnlyLettaMessage(msg)) {
      next.push(entry);
      continue;
    }
    if (cache.has(id)) {
      next.push(cache.get(id));
      continue;
    }
    const full = await fetchMessageById(client, agentId, id);
    if (full && typeof full === "object") {
      cache.set(id, full);
      next.push(full);
    } else {
      next.push(entry);
    }
  }

  return { ...root, messages: next };
}
