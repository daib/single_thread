"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { ChatPanel } from "@/components/ChatPanel";
import { ConversationSidebar } from "@/components/ConversationSidebar";
import { ProfileChatSelect } from "@/components/ProfileChatSelect";
import { RenameConversationDialog } from "@/components/RenameConversationDialog";
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
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [renameConvId, setRenameConvId] = useState<string | null>(null);

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
    if (status === "loading") return;

    if (!selectedProfileId) {
      setConversations([]);
      setSelectedConvId(null);
      setConversationsLoading(false);
      return;
    }

    const isGuest =
      status === "unauthenticated" || selectedProfileId === GUEST_PROFILE_ID;

    if (isGuest) {
      setConversationsLoading(false);
      const list = hydrateConversationsForProfile(selectedProfileId);
      setConversations(list);
      setSelectedConvId((prev) =>
        prev && list.some((c) => c.id === prev) ? prev : (list[0]?.id ?? null),
      );
      return;
    }

    let cancelled = false;
    setConversationsLoading(true);
    (async () => {
      try {
        const res = await fetch(
          `/api/profile/${encodeURIComponent(selectedProfileId)}/conversations`,
        );
        if (cancelled) return;
        if (!res.ok) {
          setConversations([]);
          setSelectedConvId(null);
          return;
        }
        const list = (await res.json()) as Conversation[];
        setConversations(list);
        setSelectedConvId((prev) =>
          prev && list.some((c) => c.id === prev) ? prev : (list[0]?.id ?? null),
        );
      } finally {
        if (!cancelled) setConversationsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedProfileId, status]);

  useEffect(() => {
    if (!selectedProfileId) return;
    const isGuest =
      status === "unauthenticated" || selectedProfileId === GUEST_PROFILE_ID;
    if (!isGuest) return;
    if (
      conversations.length > 0 &&
      !conversations.every((c) => c.profileId === selectedProfileId)
    )
      return;
    saveConversations(selectedProfileId, conversations);
  }, [selectedProfileId, conversations, status]);

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

  const renameInitialTitle = useMemo(() => {
    if (!renameConvId || !selectedProfileId) return "";
    return (
      conversations.find((c) => c.id === renameConvId && c.profileId === selectedProfileId)?.title ??
      ""
    );
  }, [renameConvId, conversations, selectedProfileId]);

  const useServerChats =
    status === "authenticated" &&
    selectedProfileId != null &&
    selectedProfileId !== GUEST_PROFILE_ID;

  const sendMessage = useCallback(
    async (conversationId: string, body: string) => {
      const profileAtSend = selectedProfileId;
      if (!profileAtSend) return;

      if (useServerChats) {
        try {
          const res = await fetch(
            `/api/conversations/${encodeURIComponent(conversationId)}/messages`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ role: "user", body }),
            },
          );
          const data = (await res.json()) as { conversation?: Conversation; error?: string };
          if (!res.ok) return;
          if (data.conversation) {
            setConversations((prev) =>
              prev.map((c) => (c.id === conversationId ? data.conversation! : c)),
            );
          }
          window.setTimeout(async () => {
            const res2 = await fetch(
              `/api/conversations/${encodeURIComponent(conversationId)}/messages`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  role: "assistant",
                  body: "This is a local demo reply — wire your API here.",
                }),
              },
            );
            const data2 = (await res2.json()) as { conversation?: Conversation };
            if (res2.ok && data2.conversation) {
              setConversations((prev) =>
                prev.map((c) => (c.id === conversationId ? data2.conversation! : c)),
              );
            }
          }, 600);
        } catch {
          /* ignore */
        }
        return;
      }

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
          const wasEmpty = c.messages.length === 0;
          const messages = [...c.messages, userMsg];
          const trimmed = body.trim();
          let title = c.title;
          if (wasEmpty && c.title === "New chat" && trimmed.length > 0) {
            title = trimmed.length > 48 ? `${trimmed.slice(0, 48)}…` : trimmed;
          }
          return {
            ...c,
            profileId: profileAtSend,
            title,
            messages,
            preview: body,
            updatedAt: now,
          };
        }),
      );

      const profileForReply = profileAtSend;
      window.setTimeout(() => {
        const reply: Message = {
          id: nextId("m"),
          role: "assistant",
          body: "This is a local demo reply — wire your API here.",
          sentAt: new Date().toISOString(),
        };
        setConversations((prev) =>
          prev.map((c) => {
            if (c.id !== conversationId || c.profileId !== profileForReply) return c;
            const messages = [...c.messages, reply];
            return {
              ...c,
              profileId: profileForReply,
              messages,
              preview: reply.body,
              updatedAt: reply.sentAt,
            };
          }),
        );
      }, 600);
    },
    [selectedProfileId, useServerChats],
  );

  const onProfileChange = useCallback((profileId: string) => {
    writeSelectedProfileId(profileId);
    setSelectedProfileId(profileId);
  }, []);

  const deleteConversation = useCallback(
    async (conversationId: string) => {
      const pid = selectedProfileId;
      if (!pid) return;

      if (useServerChats) {
        const res = await fetch(`/api/conversations/${encodeURIComponent(conversationId)}`, {
          method: "DELETE",
        });
        if (!res.ok && res.status !== 204) return;
        setConversations((prev) =>
          prev.filter((c) => !(c.id === conversationId && c.profileId === pid)),
        );
        setRenameConvId((prev) => (prev === conversationId ? null : prev));
        return;
      }

      setConversations((prev) =>
        prev.filter((c) => !(c.id === conversationId && c.profileId === pid)),
      );
      setRenameConvId((prev) => (prev === conversationId ? null : prev));
    },
    [selectedProfileId, useServerChats],
  );

  const openRename = useCallback(
    (conversationId: string) => {
      const pid = selectedProfileId;
      if (!pid) return;
      const c = conversations.find((x) => x.id === conversationId && x.profileId === pid);
      if (!c) return;
      setRenameConvId(conversationId);
    },
    [selectedProfileId, conversations],
  );

  const applyRename = useCallback(
    async (title: string) => {
      const pid = selectedProfileId;
      if (!pid || !renameConvId) return;
      const conversationId = renameConvId;

      if (useServerChats) {
        const res = await fetch(`/api/conversations/${encodeURIComponent(conversationId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
        });
        const data = (await res.json()) as { conversation?: Conversation; error?: string };
        if (!res.ok || !data.conversation) return;
        setConversations((prev) =>
          prev.map((c) =>
            c.id === conversationId && c.profileId === pid ? data.conversation! : c,
          ),
        );
        setRenameConvId(null);
        return;
      }

      const now = new Date().toISOString();
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId && c.profileId === pid
            ? { ...c, title, updatedAt: now }
            : c,
        ),
      );
      setRenameConvId(null);
    },
    [selectedProfileId, useServerChats, renameConvId],
  );

  const createNewChat = useCallback(async () => {
    const pid = selectedProfileId;
    if (!pid) return;

    if (useServerChats) {
      const res = await fetch(`/api/profile/${encodeURIComponent(pid)}/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await res.json()) as Conversation;
      if (!res.ok) return;
      setConversations((prev) => [...prev, data]);
      setSelectedConvId(data.id);
      return;
    }

    const now = new Date().toISOString();
    const id = nextId("c");
    const newConv: Conversation = {
      id,
      profileId: pid,
      title: "New chat",
      preview: "No messages yet",
      updatedAt: now,
      messages: [],
    };
    setConversations((prev) => [...prev, newConv]);
    setSelectedConvId(id);
  }, [selectedProfileId, useServerChats]);

  const branchConversation = useCallback(
    async (conversationId: string) => {
      const pid = selectedProfileId;
      if (!pid) return;

      if (useServerChats) {
        const res = await fetch(`/api/profile/${encodeURIComponent(pid)}/conversations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "branch",
            fromConversationId: conversationId,
          }),
        });
        const data = (await res.json()) as Conversation;
        if (!res.ok) return;
        setConversations((prev) => [...prev, data]);
        setSelectedConvId(data.id);
        return;
      }

      const source = conversations.find(
        (c) => c.id === conversationId && c.profileId === pid,
      );
      if (!source || source.messages.length === 0) return;

      const now = new Date().toISOString();
      const id = nextId("c");
      const truncated =
        source.title.length > 52 ? `${source.title.slice(0, 52)}…` : source.title;
      const branched: Conversation = {
        id,
        profileId: pid,
        branchOfId: source.id,
        title: truncated,
        preview: source.preview,
        updatedAt: now,
        messages: source.messages.map((m) => ({
          ...m,
          id: nextId("m"),
        })),
      };
      setConversations((prev) => [...prev, branched]);
      setSelectedConvId(id);
    },
    [selectedProfileId, useServerChats, conversations],
  );

  const authLoading = status === "loading" || (status === "authenticated" && !profilesReady);
  const needsProfile =
    status === "authenticated" && profilesReady && profileList.length === 0;
  const chatsLoading =
    useServerChats && conversationsLoading && selectedProfileId != null;

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
              Add a profile under Account to start chatting as that persona.
            </div>
          </main>
        </div>
      ) : chatsLoading ? (
        <div className="app-shell">
          <main className="main">
            <div className="empty-state">Loading conversations…</div>
          </main>
        </div>
      ) : (
        <div className="app-shell">
          <ConversationSidebar
            conversations={conversationsForProfile}
            selectedId={selectedConvId}
            onSelect={setSelectedConvId}
            onDelete={deleteConversation}
            onNewChat={createNewChat}
            onBranch={branchConversation}
            onRename={openRename}
          />
          <ChatPanel
            conversation={active}
            activeProfile={activeProfile}
            onSend={sendMessage}
            onDelete={deleteConversation}
            onBranch={branchConversation}
            onRename={openRename}
          />
        </div>
      )}
      <RenameConversationDialog
        open={renameConvId !== null}
        initialTitle={renameInitialTitle}
        onClose={() => setRenameConvId(null)}
        onConfirm={applyRename}
      />
    </div>
  );
}
