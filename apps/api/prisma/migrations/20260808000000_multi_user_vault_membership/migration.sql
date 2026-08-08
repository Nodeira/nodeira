-- Multi-user with shared vaults.
--
-- Vault membership becomes the single authorization primitive: everything inside a vault
-- (notes, folders, canvases) is reachable by exactly the users in vault_members. That only
-- works if every one of those objects actually belongs to a vault, so the previously
-- nullable vault_id columns become NOT NULL and orphans are adopted first.
--
-- Written by hand rather than generated: Prisma cannot infer who should own existing
-- vaults, which vault orphaned notes belong to, or which user the single global app_state
-- row represents.

-- ── Vault roles and membership ───────────────────────────────────────────────
CREATE TYPE "VaultRole" AS ENUM ('OWNER', 'EDITOR', 'VIEWER');

CREATE TABLE "vault_members" (
    "vault_id"   TEXT NOT NULL,
    "user_id"    TEXT NOT NULL,
    "role"       "VaultRole" NOT NULL DEFAULT 'EDITOR',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "vault_members_pkey" PRIMARY KEY ("vault_id", "user_id")
);
CREATE INDEX "vault_members_user_id_idx" ON "vault_members"("user_id");

-- ── Vault ownership ──────────────────────────────────────────────────────────
-- A vault is seeded on boot even before setup runs, so an instance that was never set up
-- can hold one empty auto-created vault and no users at all. There is no one to own it and
-- nothing of value in it; drop it and let the seed recreate it once an admin exists.
DELETE FROM "vaults" WHERE NOT EXISTS (SELECT 1 FROM "users");

ALTER TABLE "vaults" ADD COLUMN "owner_id" TEXT;

-- Existing single-tenant data belongs to the admin (setup only ever creates one user, and
-- UsersService.create hardcoded role = ADMIN). Fall back to the oldest user either way.
UPDATE "vaults" SET "owner_id" = (
    SELECT "id" FROM "users" ORDER BY ("role" = 'ADMIN') DESC, "created_at" ASC LIMIT 1
) WHERE "owner_id" IS NULL;

ALTER TABLE "vaults" ALTER COLUMN "owner_id" SET NOT NULL;
CREATE INDEX "vaults_owner_id_idx" ON "vaults"("owner_id");
ALTER TABLE "vaults" ADD CONSTRAINT "vaults_owner_id_fkey"
    FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Every owner is also a member, at OWNER level. Access checks then only consult membership.
INSERT INTO "vault_members" ("vault_id", "user_id", "role")
SELECT "id", "owner_id", 'OWNER' FROM "vaults"
ON CONFLICT DO NOTHING;

-- ── Adopt orphans ────────────────────────────────────────────────────────────
-- If anything is unfiled but no vault survives to adopt it, create one for the admin.
INSERT INTO "vaults" ("id", "name", "owner_id", "created_at", "updated_at")
SELECT gen_random_uuid(), 'Main vault',
       (SELECT "id" FROM "users" ORDER BY ("role" = 'ADMIN') DESC, "created_at" ASC LIMIT 1),
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "users")
  AND NOT EXISTS (SELECT 1 FROM "vaults")
  AND (
    EXISTS (SELECT 1 FROM "notes"    WHERE "vault_id" IS NULL) OR
    EXISTS (SELECT 1 FROM "folders"  WHERE "vault_id" IS NULL) OR
    EXISTS (SELECT 1 FROM "canvases" WHERE "vault_id" IS NULL)
  );

INSERT INTO "vault_members" ("vault_id", "user_id", "role")
SELECT "id", "owner_id", 'OWNER' FROM "vaults"
ON CONFLICT DO NOTHING;

-- Oldest vault is the one VaultsService.seed() created as "Main vault".
UPDATE "notes"    SET "vault_id" = (SELECT "id" FROM "vaults" ORDER BY "created_at" ASC LIMIT 1) WHERE "vault_id" IS NULL;
UPDATE "folders"  SET "vault_id" = (SELECT "id" FROM "vaults" ORDER BY "created_at" ASC LIMIT 1) WHERE "vault_id" IS NULL;
UPDATE "canvases" SET "vault_id" = (SELECT "id" FROM "vaults" ORDER BY "created_at" ASC LIMIT 1) WHERE "vault_id" IS NULL;

-- Anything still unassigned has no vault to belong to, which can only happen on an instance
-- that was never set up. Such rows are unreachable by any user under the new model.
DELETE FROM "notes"    WHERE "vault_id" IS NULL;
DELETE FROM "folders"  WHERE "vault_id" IS NULL;
DELETE FROM "canvases" WHERE "vault_id" IS NULL;

-- ── Require and re-key vault membership on content ───────────────────────────
ALTER TABLE "notes"    DROP CONSTRAINT IF EXISTS "notes_vault_id_fkey";
ALTER TABLE "folders"  DROP CONSTRAINT IF EXISTS "folders_vault_id_fkey";
ALTER TABLE "canvases" DROP CONSTRAINT IF EXISTS "canvases_vault_id_fkey";

ALTER TABLE "notes"    ALTER COLUMN "vault_id" SET NOT NULL;
ALTER TABLE "folders"  ALTER COLUMN "vault_id" SET NOT NULL;
ALTER TABLE "canvases" ALTER COLUMN "vault_id" SET NOT NULL;

-- CASCADE, not SET NULL: under membership-based access a row with no vault is a row nobody
-- can be authorized against.
ALTER TABLE "notes" ADD CONSTRAINT "notes_vault_id_fkey"
    FOREIGN KEY ("vault_id") REFERENCES "vaults"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "folders" ADD CONSTRAINT "folders_vault_id_fkey"
    FOREIGN KEY ("vault_id") REFERENCES "vaults"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "canvases" ADD CONSTRAINT "canvases_vault_id_fkey"
    FOREIGN KEY ("vault_id") REFERENCES "vaults"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "vault_members" ADD CONSTRAINT "vault_members_vault_id_fkey"
    FOREIGN KEY ("vault_id") REFERENCES "vaults"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vault_members" ADD CONSTRAINT "vault_members_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Hot query paths that had no index at all.
CREATE INDEX "notes_vault_id_idx"    ON "notes"("vault_id");
CREATE INDEX "notes_folder_id_idx"   ON "notes"("folder_id");
CREATE INDEX "folders_vault_id_idx"  ON "folders"("vault_id");
CREATE INDEX "canvases_vault_id_idx" ON "canvases"("vault_id");

-- ── Per-user app state ───────────────────────────────────────────────────────
-- Was a single global row (id = 'default'), so one user's open tabs overwrote everyone's.
ALTER TABLE "app_state" ADD COLUMN "user_id" TEXT;

UPDATE "app_state" SET "user_id" = (
    SELECT "id" FROM "users" ORDER BY ("role" = 'ADMIN') DESC, "created_at" ASC LIMIT 1
) WHERE "user_id" IS NULL;

DELETE FROM "app_state" WHERE "user_id" IS NULL;

ALTER TABLE "app_state" DROP CONSTRAINT "app_state_pkey";
ALTER TABLE "app_state" DROP COLUMN "id";
ALTER TABLE "app_state" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "app_state" ADD CONSTRAINT "app_state_pkey" PRIMARY KEY ("user_id");
ALTER TABLE "app_state" ADD CONSTRAINT "app_state_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── API token vault scope becomes a real reference ───────────────────────────
-- vault_id was a bare string with no referential integrity, so deleting a vault left tokens
-- scoped to an id that no longer existed. Clear those before enforcing the constraint.
UPDATE "api_tokens" SET "vault_id" = NULL
WHERE "vault_id" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "vaults" WHERE "vaults"."id" = "api_tokens"."vault_id");

CREATE INDEX "api_tokens_user_id_idx" ON "api_tokens"("user_id");
ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_vault_id_fkey"
    FOREIGN KEY ("vault_id") REFERENCES "vaults"("id") ON DELETE CASCADE ON UPDATE CASCADE;
