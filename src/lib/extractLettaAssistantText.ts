/**
 * Pull the latest assistant-visible text from a Letta non-streaming JSON response.
 * @see https://docs.letta.com/api/resources/agents/subresources/messages/methods/create/
 */
export function extractLettaAssistantText(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;
  const messages = root.messages;
  if (!Array.isArray(messages) || messages.length === 0) return null;

  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (!m || typeof m !== "object") continue;
    const msg = m as Record<string, unknown>;
    const mt = msg.message_type;
    if (mt !== "assistant_message" && mt !== "assistant") continue;
    const text = stringifyLettaContent(msg.content);
    if (text) return text;
  }

  // Fallback: some payloads may omit message_type
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (!m || typeof m !== "object") continue;
    const msg = m as Record<string, unknown>;
    const text = stringifyLettaContent(msg.content);
    if (text && typeof msg.role === "string" && msg.role === "assistant") return text;
  }

  return null;
}

function stringifyLettaContent(content: unknown): string | null {
  if (typeof content === "string") {
    const s = content.trim();
    return s.length > 0 ? s : null;
  }
  if (!Array.isArray(content)) return null;
  const parts: string[] = [];
  for (const part of content) {
    if (typeof part === "string") parts.push(part);
    else if (part && typeof part === "object" && "text" in part) {
      const t = (part as { text?: unknown }).text;
      if (typeof t === "string") parts.push(t);
    }
  }
  const s = parts.join("").trim();
  return s.length > 0 ? s : null;
}
