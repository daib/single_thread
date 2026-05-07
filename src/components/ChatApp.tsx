"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { ChatPanel } from "@/components/ChatPanel";
import { ConversationSidebar } from "@/components/ConversationSidebar";
import { ProfileChatSelect } from "@/components/ProfileChatSelect";
import {
  GUEST_PROFILE_ID,
  loadConversations,
  readSelectedProfileId,
  saveConversations,
  writeSelectedProfileId,
} from "@/lib/chatStorage";
import { seedConversations } from "@/mockData";
import type { ChatProfileOption, Conversation, Message } from "@/types";
let idCounter = 1000;
function nextId(prefix: string) {
  return `${prefix}-${++idCounter}`;
}

export function ChatApp() {
  const { status } = useSession();
  const [profileList, setProfileList] = useState<ChatProfileOption[]>([]);
  const [profilesReady, setProfilesReady] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);

  useEffect(() => {
    if (status === "loading") {
      setProfilesReady(false);
      return;
    }
    if (status === "unauthenticated") {
      setProfileList([
        { id: GUEST_PROFILE_ID, displayName: "Guest", handle: "local" },
      ]);
      setProfilesReady(true);
      return;
    }

    let cancelled = false;
    setProfilesReady(false);
    (async () => {
      const res = await fetch("/api/account");
      if (cancelled) return;
      if (!res.ok) {
        setProfileList([]);
        setProfilesReady(true);
        return;
      }
      const accounts = (await res.json()) as Array<{
        profiles: Array<{ id: string; displayName: string; handle: string }>;
      }>;
      const flat = accounts.flatMap((a) =>
        a.profiles.map((p) => ({
          id: p.id,
          displayName: p.displayName,
          handle: p.handle,
        })),
      );
      setProfileList(flat);
      setProfilesReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [status]);

  useEffect(() => {
    if (!profilesReady) return;
    if (profileList.length === 0) {
      setSelectedProfileId(null);
      return;
    }
    const saved = readSelectedProfileId();
    const next =
      saved && profileList.some((p) => p.id === saved) ? saved : profileList[0].id;
    if (saved !== next) writeSelectedProfileId(next);
    setSelectedProfileId((prev) => (prev === next ? prev : next));
  }, [profilesReady, profileList]);

  useEffect(() => {
    if (!selectedProfileId) {
      setConversations([]);
      setSelectedConvId(null);
      return;
    }
    let list = loadConversations(selectedProfileId);
    if (!list || list.length === 0) {
      list = seedConversations(selectedProfileId);
      saveConversations(selectedProfileId, list);
    }
    setConversations(list);
    setSelectedConvId(list[0]?.id ?? null);
  }, [selectedProfileId]);

  useEffect(() => {
    if (!selectedProfileId || conversations.length === 0) return;
    saveConversations(selectedProfileId, conversations);
  }, [selectedProfileId, conversations]);

  const activeProfile = useMemo(
    () => profileList.find((p) => p.id === selectedProfileId),
    [profileList, selectedProfileId],
  );

  const active = useMemo(
    () => conversations.find((c) => c.id === selectedConvId),
    [conversations, selectedConvId],
  );

  const sendMessage = useCallback(
    (conversationId: string, body: string) => {
      if (!selectedProfileId) return;
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
            profileId: selectedProfileId,
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
              profileId: selectedProfileId,
              messages,
              preview: reply.body,
              updatedAt: reply.sentAt,
            };
          }),
        );
      }, 600);
    },
    [selectedProfileId],
  );

  const onProfileChange = useCallback((profileId: string) => {
    writeSelectedProfileId(profileId);
    setSelectedProfileId(profileId);
  }, []);

  const authLoading = status === "loading" || (status === "authenticated" && !profilesReady);
  const needsProfile =
    status === "authenticated" && profilesReady && profileList.length === 0;

  return (
    <div className="chat-root">
      <ProfileChatSelect
        status={status}
        profiles={profileList}
        value={selectedProfileId}
        onChange={onProfileChange}
      />

      {authLoading ? (
        <div className="app-shell">
          <main className="main">
            <div className="empty-state">Loading…</div>
          </main>
        </div>
      ) : needsProfile ? (
        <div className="app-shell">
          <main className="main">
            <div className="empty-state">
              Add a profile under Account to start chatting as that persona. Each profile keeps its own
              conversations in this browser.
            </div>
          </main>
        </div>
      ) : (
        <div className="app-shell">
          <ConversationSidebar
            conversations={conversations}
            selectedId={selectedConvId}
            onSelect={setSelectedConvId}
          />
          <ChatPanel
            conversation={active}
            activeProfile={activeProfile}
            onSend={sendMessage}
          />
        </div>
      )}
    </div>
  );
}
