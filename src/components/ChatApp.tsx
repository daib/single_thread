"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import { useSession } from "next-auth/react";
import { ChatPanel } from "@/components/ChatPanel";
import { ConversationSidebar } from "@/components/ConversationSidebar";
import { ProfileChatSelect } from "@/components/ProfileChatSelect";
import { RenameConversationDialog } from "@/components/RenameConversationDialog";
import {
  clearSelectedProfileId,
  GUEST_PROFILE_ID,
  hydrateConversationsForProfile,
  readSelectedProfileId,
  saveConversations,
  writeSelectedProfileId,
} from "@/lib/chatStorage";
import { requestLettaReply } from "@/lib/requestLettaReply";
import type { ChatProfileOption, Conversation, Message } from "@/types";

let idCounter = 1000;
function nextId(prefix: string) {
  return `${prefix}-${++idCounter}`;
}

export function ChatApp() {
  const { status } = useSession();
  const [profileList, setProfileList] = useState<ChatProfileOption[]>([]);
  const [accountOptions, setAccountOptions] = useState<
    Array<{ id: string; displayName: string; handle: string }>
  >([]);
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
      setAccountOptions([]);
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
        setAccountOptions([]);
        setProfilesReady(true);
        return;
      }
      const accounts = (await res.json()) as Array<{
        id: string;
        displayName: string;
        handle: string;
        profiles: Array<{ id: string; displayName: string; handle: string }>;
      }>;
      setAccountOptions(
        accounts.map((a) => ({
          id: a.id,
          displayName: a.displayName,
          handle: a.handle,
        })),
      );
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

      const trimmed = body.trim();
      if (!trimmed) return;

      if (useServerChats) {
        try {
          const res = await fetch(
            `/api/conversations/${encodeURIComponent(conversationId)}/messages`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ role: "user", body: trimmed }),
            },
          );
          const data = (await res.json()) as { conversation?: Conversation; error?: string };
          if (!res.ok) return;
          if (data.conversation) {
            setConversations((prev) =>
              prev.map((c) => (c.id === conversationId ? data.conversation! : c)),
            );
          }

          const assistantBody = await requestLettaReply(
            trimmed,
            profileAtSend,
            conversationId,
          );
          if (!assistantBody.trim()) {
            return;
          }

          const replyAt = new Date().toISOString();
          const optimisticReply: Message = {
            id: nextId("m"),
            role: "assistant",
            body: assistantBody,
            sentAt: replyAt,
          };
          setConversations((prev) =>
            prev.map((c) => {
              if (c.id !== conversationId || c.profileId !== profileAtSend) return c;
              return {
                ...c,
                messages: [...c.messages, optimisticReply],
                preview: assistantBody,
                updatedAt: replyAt,
              };
            }),
          );

          const res2 = await fetch(
            `/api/conversations/${encodeURIComponent(conversationId)}/messages`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                role: "assistant",
                body: assistantBody,
              }),
            },
          );
          const data2 = (await res2.json().catch(() => ({}))) as { conversation?: Conversation };
          if (res2.ok && data2.conversation) {
            setConversations((prev) =>
              prev.map((c) =>
                c.id === conversationId && c.profileId === profileAtSend ? data2.conversation! : c,
              ),
            );
          }
        } catch {
          /* ignore */
        }
        return;
      }

      const now = new Date().toISOString();
      const userMsg: Message = {
        id: nextId("m"),
        role: "user",
        body: trimmed,
        sentAt: now,
      };

      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== conversationId || c.profileId !== profileAtSend) return c;
          const wasEmpty = c.messages.length === 0;
          const messages = [...c.messages, userMsg];
          let title = c.title;
          if (wasEmpty && c.title === "New chat" && trimmed.length > 0) {
            title = trimmed.length > 48 ? `${trimmed.slice(0, 48)}…` : trimmed;
          }
          return {
            ...c,
            profileId: profileAtSend,
            title,
            messages,
            preview: trimmed,
            updatedAt: now,
          };
        }),
      );

      const assistantBody = await requestLettaReply(trimmed);
      if (!assistantBody.trim()) {
        return;
      }
      const replyAt = new Date().toISOString();
      const reply: Message = {
        id: nextId("m"),
        role: "assistant",
        body: assistantBody,
        sentAt: replyAt,
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
            updatedAt: replyAt,
          };
        }),
      );
    },
    [selectedProfileId, useServerChats],
  );

  const onProfileChange = useCallback((profileId: string) => {
    writeSelectedProfileId(profileId);
    setSelectedProfileId(profileId);
  }, []);

  const onProfileCreated = useCallback((profile: ChatProfileOption) => {
    setProfileList((prev) => {
      if (prev.some((p) => p.id === profile.id)) return prev;
      return [...prev, profile];
    });
    setSelectedProfileId(profile.id);
    writeSelectedProfileId(profile.id);
  }, []);

  const deleteProfile = useCallback(
    async (profileId: string) => {
      if (profileId === GUEST_PROFILE_ID) {
        throw new Error("Cannot delete this profile.");
      }
      const res = await fetch(`/api/profile/${encodeURIComponent(profileId)}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 204) {
        throw new Error("Could not delete profile.");
      }

      const nextProfiles = profileList.filter((p) => p.id !== profileId);
      setProfileList(nextProfiles);
      setConversations((prev) => prev.filter((c) => c.profileId !== profileId));

      if (selectedProfileId === profileId) {
        const pick = nextProfiles[0]?.id ?? null;
        setSelectedProfileId(pick);
        if (pick) writeSelectedProfileId(pick);
        else clearSelectedProfileId();
      }

      setRenameConvId(null);
    },
    [profileList, selectedProfileId],
  );

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
    async (conversationId: string, upToMessageId?: string) => {
      const pid = selectedProfileId;
      if (!pid) return;

      if (useServerChats) {
        const res = await fetch(`/api/profile/${encodeURIComponent(pid)}/conversations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "branch",
            fromConversationId: conversationId,
            ...(upToMessageId ? { upToMessageId } : {}),
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

      let msgs = source.messages;
      if (upToMessageId) {
        const cut = msgs.findIndex((m) => m.id === upToMessageId);
        if (cut < 0) return;
        msgs = msgs.slice(0, cut + 1);
      }
      if (msgs.length === 0) return;

      const now = new Date().toISOString();
      const id = nextId("c");
      const truncated =
        source.title.length > 52 ? `${source.title.slice(0, 52)}…` : source.title;
      const lastBody = msgs[msgs.length - 1]?.body ?? "";
      const branched: Conversation = {
        id,
        profileId: pid,
        branchOfId: source.id,
        title: truncated,
        preview: upToMessageId
          ? lastBody.length > 0
            ? lastBody.slice(0, 500)
            : source.preview
          : source.preview || (lastBody.length > 0 ? lastBody.slice(0, 500) : ""),
        updatedAt: now,
        messages: msgs.map((m) => ({
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
    status === "authenticated" && profilesReady && profileList.length === 0 && accountOptions.length === 0;
  const chatsLoading =
    useServerChats && conversationsLoading && selectedProfileId != null;

  const profileSidebarHeader = (
    <ProfileChatSelect
      status={status}
      profiles={profileList}
      value={selectedProfileId}
      onChange={onProfileChange}
      accounts={status === "authenticated" ? accountOptions : undefined}
      onProfileCreated={status === "authenticated" ? onProfileCreated : undefined}
      onProfileDeleted={status === "authenticated" ? deleteProfile : undefined}
    />
  );

  let conversationsPanel: "full" | "loading" | "none" = "full";
  let mainContent: ReactNode;

  if (authLoading) {
    conversationsPanel = "none";
    mainContent = <div className="empty-state">Loading…</div>;
  } else if (needsProfile) {
    conversationsPanel = "none";
    mainContent = (
      <div className="empty-state">
        Add a profile under Account to start chatting as that persona.
      </div>
    );
  } else if (chatsLoading) {
    conversationsPanel = "loading";
    mainContent = <div className="empty-state">Loading conversations…</div>;
  } else {
    conversationsPanel = "full";
    mainContent = (
      <ChatPanel
        conversation={active}
        activeProfile={activeProfile}
        onSend={sendMessage}
        onDelete={deleteConversation}
        onBranch={branchConversation}
        onRename={openRename}
      />
    );
  }

  return (
    <>
      <div className="app-shell">
        <ConversationSidebar
          profileHeader={profileSidebarHeader}
          conversationsPanel={conversationsPanel}
          conversations={conversationsPanel === "full" ? conversationsForProfile : []}
          selectedId={conversationsPanel === "full" ? selectedConvId : null}
          onSelect={setSelectedConvId}
          onDelete={deleteConversation}
          onNewChat={createNewChat}
          onBranch={branchConversation}
          onRename={openRename}
        />
        <div className="main">{mainContent}</div>
      </div>
      <RenameConversationDialog
        open={renameConvId !== null}
        initialTitle={renameInitialTitle}
        onClose={() => setRenameConvId(null)}
        onConfirm={applyRename}
      />
    </>
  );
}
