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
