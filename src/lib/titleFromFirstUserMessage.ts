const DEFAULT_MAX_LEN = 200;

/** Single-line chat title from the first user message (e.g. naming a new branch). */
export function titleFromFirstUserMessage(raw: string, maxLen = DEFAULT_MAX_LEN): string {
  const one = raw.replace(/\s+/g, " ").trim();
  if (!one) return "(untitled)";
  if (one.length <= maxLen) return one;
  return `${one.slice(0, Math.max(1, maxLen - 1))}…`;
}
