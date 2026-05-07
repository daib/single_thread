-- Rename profiles feature to accounts (table + constraints/index names).
ALTER TABLE "profiles" RENAME TO "accounts";
ALTER TABLE "accounts" RENAME CONSTRAINT "profiles_pkey" TO "accounts_pkey";
ALTER INDEX "profiles_handle_key" RENAME TO "accounts_handle_key";
