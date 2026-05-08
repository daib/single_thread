import { describe, expect, it } from "vitest";
import { buildConversationTree } from "@/lib/conversationTree";
import type { Conversation, Message } from "@/types";

const msg = (): Message[] => [];

function c(
  id: string,
  title: string,
  updatedAt: string,
  opts: { branchOfId?: string } = {},
): Conversation {
  return {
    id,
    profileId: "p1",
    title,
    preview: "",
    updatedAt,
    messages: msg(),
    ...opts,
  };
}

describe("buildConversationTree", () => {
  it("returns empty array for no conversations", () => {
    expect(buildConversationTree([])).toEqual([]);
  });

  it("single root has no children", () => {
    const tree = buildConversationTree([c("a", "A", "2026-01-03T00:00:00.000Z")]);
    expect(tree).toHaveLength(1);
    expect(tree[0]!.conv.id).toBe("a");
    expect(tree[0]!.children).toEqual([]);
  });

  it("nests branch under parent when parent is in list", () => {
    const root = c("r", "Root", "2026-01-01T00:00:00.000Z");
    const child = c("ch", "Child", "2026-01-02T00:00:00.000Z", { branchOfId: "r" });
    const tree = buildConversationTree([root, child]);
    expect(tree).toHaveLength(1);
    expect(tree[0]!.conv.id).toBe("r");
    expect(tree[0]!.children).toHaveLength(1);
    expect(tree[0]!.children[0]!.conv.id).toBe("ch");
    expect(tree[0]!.children[0]!.children).toEqual([]);
  });

  it("treats branch as root when parent id is missing from list", () => {
    const orphan = c("o", "Orphan", "2026-01-02T00:00:00.000Z", { branchOfId: "missing" });
    const tree = buildConversationTree([orphan]);
    expect(tree).toHaveLength(1);
    expect(tree[0]!.conv.id).toBe("o");
    expect(tree[0]!.children).toEqual([]);
  });

  it("sorts roots by updatedAt descending", () => {
    const older = c("old", "Old", "2026-01-01T00:00:00.000Z");
    const newer = c("new", "New", "2026-01-05T00:00:00.000Z");
    const tree = buildConversationTree([older, newer]);
    expect(tree.map((n) => n.conv.id)).toEqual(["new", "old"]);
  });

  it("sorts sibling branches by updatedAt descending", () => {
    const root = c("r", "R", "2026-01-01T00:00:00.000Z");
    const b1 = c("b1", "B1", "2026-01-02T00:00:00.000Z", { branchOfId: "r" });
    const b2 = c("b2", "B2", "2026-01-04T00:00:00.000Z", { branchOfId: "r" });
    const tree = buildConversationTree([root, b1, b2]);
    expect(tree[0]!.children.map((n) => n.conv.id)).toEqual(["b2", "b1"]);
  });
});
