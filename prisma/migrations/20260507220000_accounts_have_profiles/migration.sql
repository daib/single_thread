-- Child profiles under accounts; move bio + per-profile identity off the account row.

CREATE TABLE "profiles" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "bio" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- One profile per existing account (preserve display name, handle, bio).
INSERT INTO "profiles" ("id", "account_id", "display_name", "handle", "bio", "created_at", "updated_at")
SELECT
    gen_random_uuid()::text,
    "id",
    "display_name",
    "handle",
    "bio",
    "created_at",
    "updated_at"
FROM "accounts";

CREATE UNIQUE INDEX "profiles_account_id_handle_key" ON "profiles"("account_id", "handle");

ALTER TABLE "profiles" ADD CONSTRAINT "profiles_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "accounts" DROP COLUMN "bio";
