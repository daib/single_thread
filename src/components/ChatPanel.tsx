import { type FormEvent, useEffect, useRef, useState } from "react";
import { formatClock } from "@/formatTime";
import type { ChatProfileOption, Conversation, Message } from "@/types";

interface Props {
  conversation: Conversation | undefined;
  activeProfile?: ChatProfileOption | null;
  onSend: (conversationId: string, body: string) => void;
  onDelete: (conversationId: string) => void;
}

function MessageBubble({ message }: { message: Message }) {
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
    </div>
  );
}

export function ChatPanel({ conversation, activeProfile, onSend, onDelete }: Props) {
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation?.id, conversation?.messages.length]);

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
            {conversation.messages.length} messages
          </p>
        </div>
        <button
          type="button"
          className="main-header-delete"
          onClick={() => onDelete(conversation.id)}
        >
          Delete chat
        </button>
      </header>
      <div className="messages">
        {conversation.messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
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
