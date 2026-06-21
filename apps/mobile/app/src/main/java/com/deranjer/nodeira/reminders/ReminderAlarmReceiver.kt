package com.deranjer.nodeira.reminders

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Fired by [ReminderScheduler]'s alarm. Posts a notification and, for recurring reminders,
 * reschedules the next occurrence (so recurrence works even without re-syncing from the API).
 */
class ReminderAlarmReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != ACTION_FIRE) return

        val id = intent.getStringExtra(EXTRA_ID) ?: return
        val title = intent.getStringExtra(EXTRA_TITLE).orEmpty().ifBlank { "Reminder" }
        val body = intent.getStringExtra(EXTRA_BODY)
        val recurrence = intent.getStringExtra(EXTRA_RECURRENCE)
        val baseFireAt = intent.getStringExtra(EXTRA_BASE_FIRE_AT)

        ReminderNotifications.show(context, id, title, body)

        // Reschedule the next occurrence for recurring reminders.
        if (!recurrence.isNullOrBlank() && baseFireAt != null) {
            ReminderScheduler.parseMillis(baseFireAt)?.let { base ->
                val next = ReminderScheduler.nextOccurrence(base, recurrence)
                if (next > System.currentTimeMillis()) {
                    val dto = com.deranjer.nodeira.data.net.ReminderDto(
                        id = id, title = title, body = body,
                        recurrence = recurrence, fireAt = baseFireAt,
                    )
                    ReminderScheduler(context).schedule(dto, next)
                }
            }
        }
    }

    companion object {
        const val ACTION_FIRE = "com.deranjer.nodeira.REMINDER_FIRE"
        const val EXTRA_ID = "id"
        const val EXTRA_TITLE = "title"
        const val EXTRA_BODY = "body"
        const val EXTRA_RECURRENCE = "recurrence"
        const val EXTRA_BASE_FIRE_AT = "base_fire_at"
    }
}
