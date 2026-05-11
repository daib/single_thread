import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ChatMoreMenu } from "@/components/ChatMoreMenu";
import { PortalTooltipButton } from "@/components/PortalTooltipButton";
import { formatClock } from "@/formatTime";
import { copyTextToClipboard } from "@/lib/copyTextToClipboard";
import { messagesBodiesDuplicate } from "@/lib/lettaAssistantDedupe";
import type { ChatProfileOption, Conversation, Message } from "@/types";

interface Props {
  conversation: Conversation | undefined;
  activeProfile?: ChatProfileOption | null;
  onSend: (conversationId: string, body: string) => void;
  onBranch: (conversationId: string, upToMessageId?: string) => void;
  onRename?: () => void;
  onDelete?: () => void;
  /** Branch entire thread (like sidebar); omit when there is nothing to copy. */
  onBranchThread?: () => void;
  onDownload?: () => void;
}

function MessageBubble({
  message,
  onBranchHere,
}: {
  message: Message;
  onBranchHere: (messageId: string) => void;
}) {
  const isUser = message.role === "user";
  return (
    <div
      className={`message-row ${isUser ? "user" : "assistant"}`}
      role="article"
      aria-label={`${message.role} message`}
    >
      <div className="role-label">{isUser ? "You" : "Assistant"}</div>
      <div className="bubble">{message.body}</div>
      <time className="timestamp" dateTime={message.sentAt}>
        {formatClock(message.sentAt)}
      </time>
      <div className="message-actions-wrap">
        <PortalTooltipButton
          tooltip="Copy message"
          ariaLabel="Copy message to clipboard"
          className="chat-more-trigger chat-more-trigger-message"
          onClick={(e) => {
            e.stopPropagation();
            void copyTextToClipboard(message.body);
          }}
        >
          <span aria-hidden className="chat-more-copy-icon">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
            </svg>
          </span>
        </PortalTooltipButton>
        <ChatMoreMenu
          conversationLabel={`${isUser ? "Your" : "Assistant"} message`}
          variant="message"
          onBranch={() => onBranchHere(message.id)}
        />
      </div>
    </div>
  );
}

export function ChatPanel({
  conversation,
  activeProfile,
  onSend,
  onBranch,
  onRename,
  onDelete,
  onBranchThread,
  onDownload,
}: Props) {
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  /** Drop consecutive assistant rows with the same body (stale Letta repeats / old DB rows). */
  const displayMessages = useMemo(() => {
    if (!conversation) return [];
    const list = conversation.messages;
    const out: Message[] = [];
    for (const m of list) {
      const prev = out[out.length - 1];
      if (
        prev &&
        m.role === "assistant" &&
        prev.role === "assistant" &&
        messagesBodiesDuplicate(prev.body, m.body)
      ) {
        continue;
      }
      out.push(m);
    }
    return out;
  }, [conversation]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation?.id, displayMessages.length]);

  if (!conversation) {
    return (
      <main className="main">
        <div className="empty-state">Select a conversation to read messages.</div>
      </main>
    );
  }

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    onSend(conversation.id, text);
    setDraft("");
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    send();
  };

  const hasHeaderActions = Boolean(onRename || onDelete || onBranchThread || onDownload);
  const headerTriggerClass = "chat-more-trigger chat-more-trigger-header";

  return (
    <main className="main">
      <header className="main-header">
        <div className="main-header-titles">
          <h1>{conversation.title}</h1>
          <p className="subtitle">
            {activeProfile ? (
              <>
                <span className="subtitle-profile">
                  {activeProfile.displayName} <span className="subtitle-handle">@{activeProfile.handle}</span>
                </span>
                <span className="subtitle-sep" aria-hidden>
                  ·
                </span>
              </>
            ) : null}
            {displayMessages.length} messages
            {conversation.branchOfId ? (
              <>
                <span className="subtitle-sep" aria-hidden>
                  ·
                </span>
                <span className="subtitle-branch">Branched</span>
              </>
            ) : null}
          </p>
        </div>
        {hasHeaderActions ? (
          <div className="main-header-actions">
            {onRename ? (
              <PortalTooltipButton
                tooltip="Rename conversation"
                ariaLabel="Rename conversation"
                className={headerTriggerClass}
                onClick={(e) => {
                  e.stopPropagation();
                  onRename();
                }}
              >
                <span aria-hidden className="chat-more-header-icon">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                    <path d="m15 5 4 4" />
                  </svg>
                </span>
              </PortalTooltipButton>
            ) : null}
            {onBranchThread ? (
              <PortalTooltipButton
                tooltip="Branch conversation"
                ariaLabel="Branch conversation"
                className={headerTriggerClass}
                onClick={(e) => {
                  e.stopPropagation();
                  onBranchThread();
                }}
              >
                <span aria-hidden className="chat-more-header-icon">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="6" x2="6" y1="3" y2="15" />
                    <circle cx="18" cy="6" r="3" />
                    <circle cx="6" cy="18" r="3" />
                    <path d="M18 9v1a2 2 0 0 1-2 2H8l-4 4" />
                  </svg>
                </span>
              </PortalTooltipButton>
            ) : null}
            {onDownload ? (
              <PortalTooltipButton
                tooltip="Download conversation"
                ariaLabel="Download conversation as JSON"
                className={headerTriggerClass}
                onClick={(e) => {
                  e.stopPropagation();
                  onDownload();
                }}
              >
                <span aria-hidden className="chat-more-header-icon">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" x2="12" y1="15" y2="3" />
                  </svg>
                </span>
              </PortalTooltipButton>
            ) : null}
            {onDelete ? (
              <PortalTooltipButton
                tooltip="Delete conversation"
                ariaLabel="Delete conversation"
                className={`${headerTriggerClass} chat-more-trigger-danger`}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
              >
                <span aria-hidden className="chat-more-header-icon">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    <line x1="10" x2="10" y1="11" y2="17" />
                    <line x1="14" x2="14" y1="11" y2="17" />
                  </svg>
                </span>
              </PortalTooltipButton>
            ) : null}
          </div>
        ) : null}
      </header>
      <div className="messages">
        {displayMessages.length === 0 ? (
          <p className="messages-empty-hint">Send a message below to start this chat.</p>
        ) : null}
        {displayMessages.map((m) => (
          <MessageBubble
            key={m.id}
            message={m}
            onBranchHere={(messageId) => onBranch(conversation.id, messageId)}
          />
        ))}
        <div ref={bottomRef} />
      </div>
      <footer className="composer">
        <form className="composer-inner" onSubmit={submit}>
          <textarea
            rows={1}
            placeholder="Message…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            aria-label="Message text"
          />
          <button type="submit" disabled={!draft.trim()}>
            Send
          </button>
        </form>
      </footer>
    </main>
  );
}
