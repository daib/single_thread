import type { Conversation } from "@/types";

export type ConversationTreeNode = {
  conv: Conversation;
  children: ConversationTreeNode[];
};

function sortByUpdatedDesc(a: Conversation, b: Conversation): number {
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}

/**
 * Builds a forest of conversation threads: roots are chats with no parent in this list
 * (or orphaned branches). Children link via `branchOfId` → parent `id`.
 */
export function buildConversationTree(conversations: Conversation[]): ConversationTreeNode[] {
  if (conversations.length === 0) return [];

  const ids = new Set(conversations.map((c) => c.id));
  const childrenByParent = new Map<string, Conversation[]>();

  for (const c of conversations) {
    const parentId = c.branchOfId;
    if (parentId && ids.has(parentId)) {
      const bucket = childrenByParent.get(parentId) ?? [];
      bucket.push(c);
      childrenByParent.set(parentId, bucket);
    }
  }

  for (const arr of childrenByParent.values()) {
    arr.sort(sortByUpdatedDesc);
  }

  const roots = conversations.filter((c) => !c.branchOfId || !ids.has(c.branchOfId));
  roots.sort(sortByUpdatedDesc);

  function nodeFor(conv: Conversation): ConversationTreeNode {
    const rawKids = childrenByParent.get(conv.id) ?? [];
    return {
      conv,
      children: rawKids.map(nodeFor),
    };
  }

  return roots.map(nodeFor);
}
