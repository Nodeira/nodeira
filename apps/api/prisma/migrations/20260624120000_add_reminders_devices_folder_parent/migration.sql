-- CreateEnum
CREATE TYPE "ReminderTargetType" AS ENUM ('NONE', 'NOTE', 'CANVAS', 'CANVAS_NODE');

-- CreateEnum
CREATE TYPE "ReminderTriggerType" AS ENUM ('TIME', 'LOCATION');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('SCHEDULED', 'FIRED', 'DISMISSED', 'SNOOZED', 'CANCELLED');

-- AlterTable
ALTER TABLE "folders" ADD COLUMN     "parent_id" TEXT;

-- CreateTable
CREATE TABLE "reminders" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "target_type" "ReminderTargetType" NOT NULL DEFAULT 'NONE',
    "target_note_id" TEXT,
    "target_canvas_id" TEXT,
    "target_node_id" TEXT,
    "trigger_type" "ReminderTriggerType" NOT NULL,
    "fire_at" TIMESTAMP(3),
    "timezone" TEXT,
    "recurrence" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "radius_m" INTEGER,
    "location_name" TEXT,
    "on_leave" BOOLEAN NOT NULL DEFAULT false,
    "status" "ReminderStatus" NOT NULL DEFAULT 'SCHEDULED',
    "snooze_until" TIMESTAMP(3),
    "last_fired_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "push_token" TEXT,
    "name" TEXT,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reminders_user_id_status_fire_at_idx" ON "reminders"("user_id", "status", "fire_at");

-- CreateIndex
CREATE UNIQUE INDEX "devices_user_id_push_token_key" ON "devices"("user_id", "push_token");

-- AddForeignKey
ALTER TABLE "folders" ADD CONSTRAINT "folders_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
