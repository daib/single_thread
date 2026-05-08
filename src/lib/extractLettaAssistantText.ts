/**
 * Pull the latest assistant-visible text from a Letta non-streaming JSON response.
 * @see https://docs.letta.com/api/resources/agents/subresources/messages/methods/create/
 */

/** Normalize `{ messages: [...] }`, raw arrays, or SDK list pages where `items` is wrongly set to the whole JSON object. */
export function coerceToMessagesArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  const o = payload as Record<string, unknown>;
  if (Array.isArray(o.messages)) return o.messages;
  if (Array.isArray(o.items)) return o.items;
  return [];
}

/** Letta list APIs may return oldest-first or newest-first; extraction assumes index length-1 is latest. Sort ascending by time/seq. */
function sortMessagesChronologically(messages: unknown[]): unknown[] {
  return [...messages].sort((a, b) => messageSortKey(a) - messageSortKey(b));
}

function messageSortKey(m: unknown): number {
  if (!m || typeof m !== "object") return 0;
  const msg = m as Record<string, unknown>;
  if (typeof msg.seq_id === "number" && Number.isFinite(msg.seq_id)) return msg.seq_id;
  if (typeof msg.seq_id === "string") {
    const n = parseFloat(msg.seq_id);
    if (!Number.isNaN(n)) return n;
  }
  for (const k of ["date", "created_at", "updated_at"]) {
    const v = msg[k];
    if (typeof v === "string") {
      const t = Date.parse(v);
      if (!Number.isNaN(t)) return t;
    }
  }
  return 0;
}

function isSystemLikeMessage(msg: Record<string, unknown>): boolean {
  const mt = msg.message_type;
  if (typeof mt === "string" && mt.toLowerCase() === "system_message") return true;
  if (msg.role === "system") return true;
  return false;
}

/** API sometimes surfaces the compiled system prompt as huge "assistant" content — never show that in the chat UI. */
function looksLikeLettaInstructionDump(text: string): boolean {
  const t = text.trim();
  if (t.length < 400) return false;
  if (/You are Letta, the latest version of Limnal/i.test(t)) return true;
  if (/Base instructions finished\.?\s*From now on, you are going to act as your persona/i.test(t)) {
    return true;
  }
  if (/### Memory \[last modified:/i.test(t) && /<human characters?=/i.test(t)) return true;
  if (
    /Your task is to converse with a user from the perspective of your persona/i.test(t) &&
    t.length > 1200
  ) {
    return true;
  }
  return false;
}

function sanitizeAssistantCandidate(text: string | null): string | null {
  if (text == null) return null;
  const s = text.trim();
  if (s.length === 0) return null;
  if (looksLikeLettaInstructionDump(s)) return null;
  return s;
}

export function extractLettaAssistantText(payload: unknown): string | null {
  const messages = sortMessagesChronologically(coerceToMessagesArray(payload));
  if (messages.length === 0) return null;

  // Prefer send_message — that's the only user-visible channel in MemGPT-style agents.
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (!m || typeof m !== "object") continue;
    const msg = m as Record<string, unknown>;
    if (isSystemLikeMessage(msg)) continue;
    const fromTools = extractSendMessageFromToolCalls(msg);
    const ok = sanitizeAssistantCandidate(fromTools);
    if (ok) return ok;
  }

  // Renamed message tools / nested args: scan all tool calls for message-shaped strings.
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (!m || typeof m !== "object") continue;
    const msg = m as Record<string, unknown>;
    if (isSystemLikeMessage(msg)) continue;
    const anyTool = sanitizeAssistantCandidate(extractUserTextFromAnyToolCall(msg));
    if (anyTool) return anyTool;
  }

  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (!m || typeof m !== "object") continue;
    const msg = m as Record<string, unknown>;
    if (isSystemLikeMessage(msg)) continue;
    if (!isAssistantLike(msg)) continue;
    const text = assistantBodyFromMessage(msg);
    const ok = sanitizeAssistantCandidate(text);
    if (ok) return ok;
  }

  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (!m || typeof m !== "object") continue;
    const msg = m as Record<string, unknown>;
    if (isSystemLikeMessage(msg)) continue;
    const text = assistantBodyFromMessage(msg);
    const ok = sanitizeAssistantCandidate(text);
    if (ok && msg.role === "assistant") return ok;
  }

  // Walk backwards skipping user + system — odd labels / InternalMessage.
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (!m || typeof m !== "object") continue;
    const msg = m as Record<string, unknown>;
    if (isSystemLikeMessage(msg) || isUserOnlyMessage(msg)) continue;
    const body = sanitizeAssistantCandidate(assistantBodyFromMessage(msg));
    if (body) return body;
    const fromTools = sanitizeAssistantCandidate(extractSendMessageFromToolCalls(msg));
    if (fromTools) return fromTools;
    const fromReturns = sanitizeAssistantCandidate(extractToolReturnsText(msg));
    if (fromReturns) return fromReturns;
  }

  // Last resort: reasoning (short internal chain-of-thought; sanitize dumps anyway).
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (!m || typeof m !== "object") continue;
    const msg = m as Record<string, unknown>;
    if (isSystemLikeMessage(msg)) continue;
    const mt = typeof msg.message_type === "string" ? msg.message_type.toLowerCase() : "";
    if (mt === "reasoning_message" && typeof msg.reasoning === "string") {
      const ok = sanitizeAssistantCandidate(msg.reasoning);
      if (ok) return ok;
    }
  }

  // When the model stops without send_message, self-hosted Letta often only persists internal_monologue.
  const maxInternalChars = 6_000;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (!m || typeof m !== "object") continue;
    const msg = m as Record<string, unknown>;
    if (isSystemLikeMessage(msg)) continue;
    const mt = typeof msg.message_type === "string" ? msg.message_type.toLowerCase() : "";
    if (mt !== "internal_monologue") continue;
    if (typeof msg.internal_monologue === "string") {
      const ok = sanitizeAssistantCandidate(msg.internal_monologue);
      if (ok) {
        return ok.length > maxInternalChars ? `${ok.slice(0, maxInternalChars)}…` : ok;
      }
    }
  }

  return null;
}

function isUserOnlyMessage(msg: Record<string, unknown>): boolean {
  const mt = msg.message_type;
  if (typeof mt === "string" && mt.toLowerCase() === "user_message") return true;
  if (msg.role === "user") return true;
  return false;
}

function isAssistantLike(msg: Record<string, unknown>): boolean {
  const mt = msg.message_type;
  if (typeof mt === "string") {
    const lower = mt.toLowerCase();
    if (lower === "tool_call_message" || lower === "tool_return_message") return false;
    if (lower === "assistant_message" || lower === "assistant") return true;
  }
  if (msg.role === "assistant") return true;
  return false;
}

/** Visible assistant body: `content` (string / parts / shaped object), or legacy top-level `text`. */
function assistantBodyFromMessage(msg: Record<string, unknown>): string | null {
  const fromContent = stringifyLettaContent(msg.content);
  if (fromContent) return fromContent;
  if (typeof msg.text === "string") {
    const s = msg.text.trim();
    return s.length > 0 ? s : null;
  }
  if (typeof msg.body === "string") {
    const s = msg.body.trim();
    return s.length > 0 ? s : null;
  }
  if (typeof msg.message === "string") {
    const s = msg.message.trim();
    return s.length > 0 ? s : null;
  }
  // Legacy tool_return_message rows sometimes expose only this field.
  if (typeof msg.tool_return === "string") {
    const s = msg.tool_return.trim();
    return s.length > 0 ? s : null;
  }
  // Older MemGPT / self-hosted list format: function_return, function_call (not content/tool_calls).
  const fromFnRet = legacyFunctionReturnText(msg);
  if (fromFnRet) return fromFnRet;
  if (typeof msg.arguments === "string") {
    const t = textFromAnyToolArguments(msg.arguments);
    if (t) return t;
  }
  return null;
}

function legacyFunctionReturnText(msg: Record<string, unknown>): string | null {
  const fr = msg.function_return;
  if (typeof fr !== "string") return null;
  const raw = fr.trim();
  if (raw.length === 0) return null;
  try {
    const j = JSON.parse(raw) as Record<string, unknown>;
    for (const key of ["message", "content", "text", "reply", "user_message"]) {
      const v = j[key];
      if (typeof v === "string") {
        const ok = sanitizeAssistantCandidate(v);
        if (ok) return ok;
      }
    }
  } catch {
    /* not JSON */
  }
  if (isNoiseFunctionReturnAck(raw)) return null;
  return sanitizeAssistantCandidate(raw);
}

function isNoiseFunctionReturnAck(s: string): boolean {
  const t = s.trim().toLowerCase();
  if (t.length <= 2) return true;
  return /^(success|ok\.?|done|none|null|true|false|no response)$/i.test(t);
}

function extractToolReturnsText(msg: Record<string, unknown>): string | null {
  const tr = msg.tool_returns;
  if (!Array.isArray(tr)) return null;
  for (let i = tr.length - 1; i >= 0; i--) {
    const row = tr[i];
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const fr = r.func_response;
    if (typeof fr === "string") {
      const s = fr.trim();
      if (s.length > 0) return s;
    }
    const tre = r.tool_return;
    if (typeof tre === "string") {
      const s = tre.trim();
      if (s.length > 0) return s;
    }
    if (Array.isArray(tre) || (tre && typeof tre === "object")) {
      const s = stringifyLettaContent(tre);
      if (s) return s;
    }
  }
  return null;
}

function stringifyLettaContent(content: unknown): string | null {
  if (typeof content === "string") {
    const s = content.trim();
    return s.length > 0 ? s : null;
  }
  if (content && typeof content === "object" && !Array.isArray(content)) {
    const o = content as Record<string, unknown>;
    if (typeof o.text === "string") {
      const s = o.text.trim();
      if (s.length > 0) return s;
    }
  }
  if (!Array.isArray(content)) return null;
  const parts: string[] = [];
  for (const part of content) {
    if (typeof part === "string") parts.push(part);
    else if (part && typeof part === "object") {
      const p = part as Record<string, unknown>;
      if (typeof p.text === "string") parts.push(p.text);
      else if (typeof p.content === "string") parts.push(p.content);
    }
  }
  const s = parts.join("").trim();
  return s.length > 0 ? s : null;
}

function extractSendMessageFromToolCalls(msg: Record<string, unknown>): string | null {
  const calls = normalizeToolCalls(msg);
  for (const tc of calls) {
    if (!tc || typeof tc !== "object") continue;
    const c = tc as Record<string, unknown>;
    const name = toolCallName(c);
    if (!isSendMessageToolName(name)) continue;
    const text = textFromAnyToolArguments(toolCallArguments(c));
    if (text) return text;
  }
  return null;
}

/** Any tool whose arguments contain a user-facing string (letta_v1 may rename send_message). */
function extractUserTextFromAnyToolCall(msg: Record<string, unknown>): string | null {
  for (const tc of normalizeToolCalls(msg)) {
    if (!tc || typeof tc !== "object") continue;
    const c = tc as Record<string, unknown>;
    const name = toolCallName(c);
    if (name && isNonUserFacingToolName(name)) continue;
    const text = textFromAnyToolArguments(toolCallArguments(c));
    if (text) return text;
  }
  return null;
}

function isNonUserFacingToolName(name: string): boolean {
  const n = name.toLowerCase();
  return /conversation_search|archival_memory|core_memory_|grep_files|run_terminal_cmd|web_search|http_request|list_dir|read_file/i.test(
    n,
  );
}

function toolCallName(c: Record<string, unknown>): string {
  if (typeof c.name === "string") return c.name;
  if (typeof c.func_name === "string") return c.func_name;
  if (typeof c.function_name === "string") return c.function_name;
  const fn = c.function;
  if (fn && typeof fn === "object") {
    const n = (fn as Record<string, unknown>).name;
    if (typeof n === "string") return n;
  }
  return "";
}

function toolCallArguments(c: Record<string, unknown>): unknown {
  if (c.arguments !== undefined && c.arguments !== null) return c.arguments;
  const fn = c.function;
  if (fn && typeof fn === "object") {
    const a = (fn as Record<string, unknown>).arguments;
    if (a !== undefined && a !== null) return a;
  }
  return c.arguments;
}

function normalizeToolCalls(msg: Record<string, unknown>): unknown[] {
  const out: unknown[] = [];
  const raw = msg.tool_calls;
  if (Array.isArray(raw)) {
    for (const x of raw) out.push(x);
  } else if (raw && typeof raw === "object") {
    out.push(raw);
  }
  if (msg.tool_call && typeof msg.tool_call === "object") {
    out.push(msg.tool_call);
  }
  if (msg.function_call && typeof msg.function_call === "object") {
    out.push(msg.function_call);
  } else if (typeof msg.function_call === "string") {
    const p = parseToolArguments(msg.function_call);
    if (p) out.push(p);
  }
  const content = msg.content;
  if (Array.isArray(content)) {
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const p = part as Record<string, unknown>;
      const typ = typeof p.type === "string" ? p.type.toLowerCase() : "";
      if (typ === "tool_call" && p.input && typeof p.input === "object") {
        out.push({ name: p.name, arguments: JSON.stringify(p.input) });
      }
    }
  }
  return out;
}

function isSendMessageToolName(name: string): boolean {
  const n = name.toLowerCase();
  return n === "send_message" || n.endsWith("send_message") || n.includes("send_message");
}

function parseToolArguments(raw: unknown): Record<string, unknown> | null {
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t) return null;
    try {
      return JSON.parse(t) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return null;
}

/** Pull user-visible text from tool arguments (nested params/input/kwargs; MemGPT message field). */
function textFromAnyToolArguments(raw: unknown): string | null {
  const parsed = parseToolArguments(raw);
  if (parsed) {
    const direct = textFromSendMessageArgs(parsed);
    if (direct) return direct;
    const nested = deepFindToolMessageString(parsed);
    if (nested) return nested;
  }
  if (typeof raw === "string") {
    const loose = looseExtractQuotedMessage(raw);
    const ok = sanitizeAssistantCandidate(loose);
    if (ok) return ok;
  }
  return null;
}

function deepFindToolMessageString(obj: unknown, depth = 0): string | null {
  if (depth > 8 || obj == null) return null;
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
  const o = obj as Record<string, unknown>;
  const priority = [
    "message",
    "user_message",
    "content",
    "text",
    "reply",
    "msg",
    "assistant_response",
  ];
  for (const key of priority) {
    const v = o[key];
    if (typeof v === "string") {
      const ok = sanitizeAssistantCandidate(v);
      if (ok) return ok;
    }
  }
  const skipKeys = new Set(["inner_thoughts", "signature", "id", "tool_call_id"]);
  for (const [k, v] of Object.entries(o)) {
    if (skipKeys.has(k)) continue;
    if (k === "params" || k === "input" || k === "kwargs" || k === "arguments") {
      const found = deepFindToolMessageString(v, depth + 1);
      if (found) return found;
    }
  }
  for (const [k, v] of Object.entries(o)) {
    if (skipKeys.has(k) || k === "inner_thoughts") continue;
    const found = deepFindToolMessageString(v, depth + 1);
    if (found) return found;
  }
  return null;
}

/** MemGPT / Letta `send_message` kwargs & nested `params` (see Letta tool schemas). */
function textFromSendMessageArgs(parsed: Record<string, unknown>): string | null {
  const params =
    parsed.params && typeof parsed.params === "object"
      ? (parsed.params as Record<string, unknown>)
      : null;
  const input =
    parsed.input && typeof parsed.input === "object" ? (parsed.input as Record<string, unknown>) : null;
  const kwargs =
    parsed.kwargs && typeof parsed.kwargs === "object"
      ? (parsed.kwargs as Record<string, unknown>)
      : null;
  for (const bucket of [parsed, params, input, kwargs]) {
    if (!bucket) continue;
    for (const key of ["message", "content", "text", "reply", "user_message"]) {
      const v = bucket[key];
      if (typeof v === "string") {
        const ok = sanitizeAssistantCandidate(v);
        if (ok) return ok;
      }
    }
  }
  return null;
}

/** When JSON.parse fails (rare), try to pull "message":"..." from the raw argument string. */
function looseExtractQuotedMessage(raw: string): string | null {
  const m = raw.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (m?.[1]) {
    try {
      return JSON.parse(`"${m[1]}"`) as string;
    } catch {
      return m[1].replace(/\\"/g, '"');
    }
  }
  return null;
}
