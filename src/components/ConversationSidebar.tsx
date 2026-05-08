"use client";

import type { ReactNode } from "react";
import { ChatMoreMenu } from "@/components/ChatMoreMenu";
import { formatRelativeTime } from "@/formatTime";
import { buildConversationTree, type ConversationTreeNode } from "@/lib/conversationTree";
import type { Conversation } from "@/types";

export type ConversationSidebarConversationsPanel = "full" | "loading" | "none";

interface Props {
  /** Profile switcher, new/delete profile — shown at top of sidebar. */
  profileHeader?: ReactNode;
  /** e.g. link to `/account`, pinned bottom-left of the sidebar. */
  sidebarFooter?: ReactNode;
  /** When not `full`, conversation list is hidden or shows a loading state. */
  conversationsPanel?: ConversationSidebarConversationsPanel;
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNewChat: () => void;
  onBranch: (id: string, upToMessageId?: string) => void;
  onRename: (id: string) => void;
  onDownload: (conversation: Conversation) => void;
}

function ConversationTreeBranch({
  node,
  selectedId,
  onSelect,
  onDelete,
  onBranch,
  onRename,
  onDownload,
}: {
  node: ConversationTreeNode;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onBranch: (id: string, upToMessageId?: string) => void;
  onRename: (id: string) => void;
  onDownload: (conversation: Conversation) => void;
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
          onDownload={() => onDownload(conv)}
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
              onDownload={onDownload}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function ConversationSidebar({
  profileHeader,
  sidebarFooter,
  conversationsPanel = "full",
  conversations,
  selectedId,
  onSelect,
  onDelete,
  onNewChat,
  onBranch,
  onRename,
  onDownload,
}: Props) {
  const tree = buildConversationTree(conversations);
  const showConversations = conversationsPanel !== "none";
  const listLoading = conversationsPanel === "loading";
  const asideLabel = showConversations ? "Profile and conversations" : "Profile";

  return (
    <aside className="sidebar" aria-label={asideLabel}>
      {profileHeader ? <div className="sidebar-profile-region">{profileHeader}</div> : null}
      <div className="sidebar-body">
        {showConversations ? (
          <>
            <div className="sidebar-header">
              <h2 className="sidebar-title">Conversations</h2>
              <button
                type="button"
                className="sidebar-new-chat"
                onClick={onNewChat}
                disabled={listLoading}
              >
                New chat
              </button>
            </div>
            {listLoading ? (
              <div className="conversation-list conversation-list-loading" role="status">
                Loading conversations…
              </div>
            ) : (
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
                    onDownload={onDownload}
                  />
                ))}
              </ul>
            )}
          </>
        ) : null}
      </div>
      {sidebarFooter ? <div className="sidebar-footer">{sidebarFooter}</div> : null}
    </aside>
  );
}
