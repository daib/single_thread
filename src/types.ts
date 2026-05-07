export type Role = "user" | "assistant";

export interface Message {
  id: string;
  role: Role;
  body: string;
  sentAt: string;
}

export interface Conversation {
  id: string;
  /** Which profile owns this thread (persisted per profile in the client). */
  profileId: string;
  title: string;
  preview: string;
  updatedAt: string;
  messages: Message[];
}

export type ChatProfileOption = {
  id: string;
  displayName: string;
  handle: string;
};
