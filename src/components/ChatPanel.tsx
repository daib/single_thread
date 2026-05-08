import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ChatMoreMenu } from "@/components/ChatMoreMenu";
import { formatClock } from "@/formatTime";
import { messagesBodiesDuplicate } from "@/lib/lettaAssistantDedupe";
import type { ChatProfileOption, Conversation, Message } from "@/types";

interface Props {
  conversation: Conversation | undefined;
  activeProfile?: ChatProfileOption | null;
  onSend: (conversationId: string, body: string) => void;
  onDelete: (conversationId: string) => void;
  onBranch: (conversationId: string, upToMessageId?: string) => void;
  onRename: (conversationId: string) => void;
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
  onDelete,
  onBranch,
  onRename,
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

  return (
    <main className="main">
      <header className="main-header">
        <div>
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
        <ChatMoreMenu
          conversationLabel={conversation.title}
          variant="header"
          onRename={() => onRename(conversation.id)}
          onDelete={() => onDelete(conversation.id)}
          onBranch={
            displayMessages.length > 0
              ? () => onBranch(conversation.id)
              : undefined
          }
        />
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
