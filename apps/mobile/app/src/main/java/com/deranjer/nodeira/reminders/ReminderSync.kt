package com.deranjer.nodeira.reminders

import android.util.Log
import com.deranjer.nodeira.data.NodeiraRepository
import com.deranjer.nodeira.data.ReminderCache
import com.deranjer.nodeira.data.net.ReminderDto

/**
 * Pulls the reminder list and registers everything that has to exist on-device for it:
 * exact alarms for TIME reminders, proximity alerts for LOCATION ones, and a cache snapshot
 * so [BootReceiver] can replay both after a reboot.
 *
 * Extracted from RemindersViewModel because it is no longer only the screen's job. Reminders
 * created on the web or desktop client are invisible to the phone until something asks the
 * API for them — and until then no alarm exists, so they simply never fire here. That sync
 * now also runs from [ReminderSyncWorker] on a schedule and after the notifications socket
 * reports a reminder firing, and all three paths must do the same three things in the same
 * order or the phone ends up with alarms that disagree with the cache.
 */
class ReminderSync(
    private val repository: NodeiraRepository,
    private val scheduler: ReminderScheduler,
    private val geofences: LocationGeofenceManager,
    private val cache: ReminderCache,
) {

    /** Fetches, registers and caches. Throws whatever the network layer throws. */
    suspend fun run(): List<ReminderDto> {
        val reminders = repository.getReminders()
        scheduler.sync(reminders)
        geofences.sync(reminders)
        cache.save(reminders)
        return reminders
    }

    /** Same, but reports failure instead of throwing — for callers with nowhere to show it. */
    suspend fun runQuietly(): Boolean = try {
        run()
        true
    } catch (e: Exception) {
        Log.w(TAG, "Reminder sync failed", e)
        false
    }

    private companion object {
        const val TAG = "ReminderSync"
    }
}
