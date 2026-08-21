-- AlterTable
ALTER TABLE "canvases" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "folders" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "notes" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "canvases_vault_id_deleted_at_idx" ON "canvases"("vault_id", "deleted_at");

-- CreateIndex
CREATE INDEX "folders_vault_id_deleted_at_idx" ON "folders"("vault_id", "deleted_at");

-- CreateIndex
CREATE INDEX "notes_vault_id_deleted_at_idx" ON "notes"("vault_id", "deleted_at");
