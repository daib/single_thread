import type { Conversation } from "@/types";

const TITLE_MAX = 52;

function truncateTitle(title: string): string {
  const t = title.trim();
  if (!t) return "New chat";
  return t.length > TITLE_MAX ? `${t.slice(0, TITLE_MAX)}…` : t;
}

type TitleLink = { title: string };

/**
 * `path` is ordered from branch source → … → lineage root (root last).
 * New branch title = the **first** conversation after the root along that chain:
 * the direct child of the root, i.e. `path[path.length - 2]` when length ≥ 2;
 * if the source is the root (path length 1), use the source title.
 */
export function branchTitleFromSourceToRootPath(path: TitleLink[]): string {
  if (path.length === 0) return truncateTitle("New chat");
  const pick = path.length >= 2 ? path[path.length - 2]! : path[0]!;
  return truncateTitle(pick.title);
}

/** Client: walk `branchOfId` through `all` to build the path, then pick title. */
export function branchTitleFromSourceInList(source: Conversation, all: Conversation[]): string {
  const path: TitleLink[] = [{ title: source.title }];
  const byId = new Map(all.map((c) => [c.id, c] as const));
  const seen = new Set<string>([source.id]);
  let bid = source.branchOfId;
  while (bid) {
    if (seen.has(bid)) break;
    seen.add(bid);
    const p = byId.get(bid);
    if (!p) break;
    path.push({ title: p.title });
    bid = p.branchOfId;
  }
  return branchTitleFromSourceToRootPath(path);
}
