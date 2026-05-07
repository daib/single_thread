"use client";

import { useCallback, useMemo, useState } from "react";
import { ChatPanel } from "@/components/ChatPanel";
import { ConversationSidebar } from "@/components/ConversationSidebar";
import { initialConversations } from "@/mockData";
import type { Conversation, Message } from "@/types";

let idCounter = 1000;
function nextId(prefix: string) {
  return `${prefix}-${++idCounter}`;
}

export function ChatApp() {
  const [conversations, setConversations] = useState<Conversation[]>(
    () => initialConversations,
  );
  const [selectedId, setSelectedId] = useState<string | null>(
    () => initialConversations[0]?.id ?? null,
  );

  const active = useMemo(
    () => conversations.find((c) => c.id === selectedId),
    [conversations, selectedId],
  );

  const sendMessage = useCallback((conversationId: string, body: string) => {
    const now = new Date().toISOString();
    const userMsg: Message = {
      id: nextId("m"),
      role: "user",
      body,
      sentAt: now,
    };

    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== conversationId) return c;
        const messages = [...c.messages, userMsg];
        return {
          ...c,
          messages,
          preview: body,
          updatedAt: now,
        };
      }),
    );

    window.setTimeout(() => {
      const reply: Message = {
        id: nextId("m"),
        role: "assistant",
        body: "This is a local demo reply — wire your API here.",
        sentAt: new Date().toISOString(),
      };
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== conversationId) return c;
          const messages = [...c.messages, reply];
          return {
            ...c,
            messages,
            preview: reply.body,
            updatedAt: reply.sentAt,
          };
        }),
      );
    }, 600);
  }, []);

  return (
    <div className="app-shell">
      <ConversationSidebar
        conversations={conversations}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />
      <ChatPanel conversation={active} onSend={sendMessage} />
    </div>
  );
}
