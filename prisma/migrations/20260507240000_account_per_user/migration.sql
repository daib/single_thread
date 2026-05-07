-- One AppAccount per Auth.js user (session.user.id === JWT `sub`).
ALTER TABLE "accounts" ADD COLUMN "user_id" TEXT;

UPDATE "accounts" SET "user_id" = 'legacy:' || "id" WHERE "user_id" IS NULL;

ALTER TABLE "accounts" ALTER COLUMN "user_id" SET NOT NULL;

CREATE UNIQUE INDEX "accounts_user_id_key" ON "accounts"("user_id");
