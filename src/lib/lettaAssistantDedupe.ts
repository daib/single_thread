import type { Message } from "@/types";

/** Collapse whitespace so Letta vs DB copies still match for dedupe. */
export function normalizeForDedupe(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

export function messagesBodiesDuplicate(a: string, b: string): boolean {
  return normalizeForDedupe(a) === normalizeForDedupe(b);
}

/** Last assistant body when the thread ends with the latest user message (current send). */
export function getLastAssistantBeforeTrailingUser(messages: Message[]): string | undefined {
  if (messages.length === 0) return undefined;
  const last = messages[messages.length - 1];
  if (last.role !== "user") {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") return messages[i].body;
    }
    return undefined;
  }
  for (let i = messages.length - 2; i >= 0; i--) {
    if (messages[i].role === "assistant") return messages[i].body;
  }
  return undefined;
}

/**
 * Show / persist an assistant bubble when there is user-visible text.
 * Drops Python None / null placeholders and empty replies only (no duplicate suppression).
 */
export function shouldShowAssistantReply(nextBody: string, _previousAssistantBody?: string | null): boolean {
  const t = nextBody.trim();
  if (!t) return false;
  if (/^(none|null)$/i.test(t)) return false;
  return true;
}
