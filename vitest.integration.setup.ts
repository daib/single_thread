import { afterAll, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";

beforeEach(async () => {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "chat_messages",
      "chat_conversations",
      "profiles",
      "accounts"
    RESTART IDENTITY CASCADE;
  `);
});

afterAll(async () => {
  await prisma.$disconnect();
});
