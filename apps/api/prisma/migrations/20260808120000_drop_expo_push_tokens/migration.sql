-- Removes the Expo push token column.
--
-- The push path it fed was orphaned when the React Native app was replaced by the native
-- Kotlin one, which never registered a token — so the server had been dispatching to an
-- empty set for months. Android reminders fire on-device via AlarmManager; web and desktop
-- receive them over the /notifications WebSocket. A device row is now just a record that a
-- client connected.
DROP INDEX IF EXISTS "devices_user_id_push_token_key";
ALTER TABLE "devices" DROP COLUMN IF EXISTS "push_token";

-- The lookup that actually happens (all of a user's devices) had no index.
CREATE INDEX IF NOT EXISTS "devices_user_id_idx" ON "devices"("user_id");
