export type Role = "user" | "assistant";

export interface Message {
  id: string;
  role: Role;
  body: string;
  sentAt: string;
}

export interface Conversation {
  id: string;
  title: string;
  preview: string;
  updatedAt: string;
  messages: Message[];
}
