-- AlterTable
ALTER TABLE "chat_conversations"
ADD COLUMN IF NOT EXISTS "letta_conversation_id" TEXT;
