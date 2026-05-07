"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { ChatPanel } from "@/components/ChatPanel";
import { ConversationSidebar } from "@/components/ConversationSidebar";
import { ProfileChatSelect } from "@/components/ProfileChatSelect";
import {
  GUEST_PROFILE_ID,
  hydrateConversationsForProfile,
  readSelectedProfileId,
  saveConversations,
  writeSelectedProfileId,
} from "@/lib/chatStorage";
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

  useLayoutEffect(() => {
    if (!selectedProfileId) {
      setConversations([]);
      setSelectedConvId(null);
      return;
    }
    const list = hydrateConversationsForProfile(selectedProfileId);
    setConversations(list);
    setSelectedConvId((prev) =>
      prev && list.some((c) => c.id === prev) ? prev : (list[0]?.id ?? null),
    );
  }, [selectedProfileId]);

  useEffect(() => {
    if (!selectedProfileId) return;
    if (conversations.length > 0 && !conversations.every((c) => c.profileId === selectedProfileId)) return;
    saveConversations(selectedProfileId, conversations);
  }, [selectedProfileId, conversations]);

  useLayoutEffect(() => {
    if (!selectedProfileId) return;
    const forProfile = conversations.filter((c) => c.profileId === selectedProfileId);
    if (forProfile.length === 0) {
      setSelectedConvId(null);
      return;
    }
    const ok = selectedConvId !== null && forProfile.some((c) => c.id === selectedConvId);
    if (ok) return;
    setSelectedConvId(forProfile[0]!.id);
  }, [conversations, selectedProfileId, selectedConvId]);

  const conversationsForProfile = useMemo(
    () =>
      selectedProfileId
        ? conversations.filter((c) => c.profileId === selectedProfileId)
        : [],
    [conversations, selectedProfileId],
  );

  const activeProfile = useMemo(
    () => profileList.find((p) => p.id === selectedProfileId),
    [profileList, selectedProfileId],
  );

  const active = useMemo(
    () => conversationsForProfile.find((c) => c.id === selectedConvId),
    [conversationsForProfile, selectedConvId],
  );

  const sendMessage = useCallback(
    (conversationId: string, body: string) => {
      const profileAtSend = selectedProfileId;
      if (!profileAtSend) return;
      const now = new Date().toISOString();
      const userMsg: Message = {
        id: nextId("m"),
        role: "user",
        body,
        sentAt: now,
      };

      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== conversationId || c.profileId !== profileAtSend) return c;
          const messages = [...c.messages, userMsg];
          return {
            ...c,
            profileId: profileAtSend,
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
            if (c.id !== conversationId || c.profileId !== profileAtSend) return c;
            const messages = [...c.messages, reply];
            return {
              ...c,
              profileId: profileAtSend,
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

  const deleteConversation = useCallback(
    (conversationId: string) => {
      const pid = selectedProfileId;
      if (!pid) return;
      setConversations((prev) =>
        prev.filter((c) => !(c.id === conversationId && c.profileId === pid)),
      );
    },
    [selectedProfileId],
  );

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
            conversations={conversationsForProfile}
            selectedId={selectedConvId}
            onSelect={setSelectedConvId}
            onDelete={deleteConversation}
          />
          <ChatPanel
            conversation={active}
            activeProfile={activeProfile}
            onSend={sendMessage}
            onDelete={deleteConversation}
          />
        </div>
      )}
    </div>
  );
}
