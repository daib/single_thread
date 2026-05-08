"use client";

import { ChatMoreMenu } from "@/components/ChatMoreMenu";
import { formatRelativeTime } from "@/formatTime";
import { buildConversationTree, type ConversationTreeNode } from "@/lib/conversationTree";
import type { Conversation } from "@/types";

interface Props {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNewChat: () => void;
  onBranch: (id: string) => void;
  onRename: (id: string) => void;
}

function ConversationTreeBranch({
  node,
  selectedId,
  onSelect,
  onDelete,
  onBranch,
  onRename,
}: {
  node: ConversationTreeNode;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onBranch: (id: string) => void;
  onRename: (id: string) => void;
}) {
  const { conv, children } = node;
  const active = conv.id === selectedId;
  const isNested = Boolean(conv.branchOfId);

  return (
    <li className="conversation-tree-branch">
      <div className={`conversation-row${isNested ? " conversation-row-nested" : ""}`}>
        <button
          type="button"
          id={conv.id}
          aria-current={active ? "true" : undefined}
          aria-label={`Open conversation: ${conv.title}`}
          className={`conversation-item${active ? " active" : ""}`}
          onClick={() => onSelect(conv.id)}
        >
          <div className="conversation-item-title">
            {isNested ? (
              <span className="conversation-branch-tag" title="Branched thread">
                ↳
              </span>
            ) : null}
            {conv.title}
          </div>
          <div className="conversation-item-preview">{conv.preview}</div>
          <div className="conversation-meta">{formatRelativeTime(conv.updatedAt)}</div>
        </button>
        <ChatMoreMenu
          conversationLabel={conv.title}
          variant="sidebar"
          onRename={() => onRename(conv.id)}
          onDelete={() => onDelete(conv.id)}
          onBranch={conv.messages.length > 0 ? () => onBranch(conv.id) : undefined}
        />
      </div>
      {children.length > 0 ? (
        <ul className="conversation-tree-children">
          {children.map((ch) => (
            <ConversationTreeBranch
              key={ch.conv.id}
              node={ch}
              selectedId={selectedId}
              onSelect={onSelect}
              onDelete={onDelete}
              onBranch={onBranch}
              onRename={onRename}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function ConversationSidebar({
  conversations,
  selectedId,
  onSelect,
  onDelete,
  onNewChat,
  onBranch,
  onRename,
}: Props) {
  const tree = buildConversationTree(conversations);

  return (
    <aside className="sidebar" aria-label="Conversations">
      <div className="sidebar-header">
        <h2 className="sidebar-title">Conversations</h2>
        <button type="button" className="sidebar-new-chat" onClick={onNewChat}>
          New chat
        </button>
      </div>
      <ul className="conversation-list">
        {tree.map((node) => (
          <ConversationTreeBranch
            key={node.conv.id}
            node={node}
            selectedId={selectedId}
            onSelect={onSelect}
            onDelete={onDelete}
            onBranch={onBranch}
            onRename={onRename}
          />
        ))}
      </ul>
    </aside>
  );
}
