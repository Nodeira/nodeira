-- CreateEnum
CREATE TYPE "NoteType" AS ENUM ('note', 'quick');

-- CreateTable
CREATE TABLE "vaults" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vaults_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "folders" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vault_id" TEXT,
    "icon" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notes" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Untitled',
    "type" "NoteType" NOT NULL DEFAULT 'note',
    "vault_id" TEXT,
    "folder_id" TEXT,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "icon" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "kind" TEXT,
    "kind_meta" JSONB,
    "yjs_state" BYTEA,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_state" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "openTabs" TEXT[],
    "active_note_id" TEXT,

    CONSTRAINT "app_state_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugins" (
    "id" TEXT NOT NULL,
    "plugin_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "installed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plugins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plugins_plugin_id_key" ON "plugins"("plugin_id");

-- AddForeignKey
ALTER TABLE "folders" ADD CONSTRAINT "folders_vault_id_fkey" FOREIGN KEY ("vault_id") REFERENCES "vaults"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_vault_id_fkey" FOREIGN KEY ("vault_id") REFERENCES "vaults"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
