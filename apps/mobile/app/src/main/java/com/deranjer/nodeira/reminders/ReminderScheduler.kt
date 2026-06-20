package com.deranjer.nodeira.reminders

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import com.deranjer.nodeira.data.net.ReminderDto
import java.time.Instant
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.ZonedDateTime

/**
 * Schedules TIME reminders as on-device exact alarms so they fire even offline / when the
 * app is closed — no Google Play Services / FCM needed (important for the F-Droid audience).
 * LOCATION reminders are handled separately (geofence; follow-up).
 *
 * Note: AlarmManager alarms do not survive a reboot. Re-scheduling happens whenever the
 * reminders list loads; surviving reboot (a BootReceiver + local cache) is a follow-up.
 */
class ReminderScheduler(private val context: Context) {

    private val alarmManager =
        context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

    /** Schedules eligible TIME reminders and cancels the rest. */
    fun sync(reminders: List<ReminderDto>) {
        reminders.forEach { reminder ->
            val triggerAt = triggerTimeMillis(reminder)
            if (eligible(reminder) && triggerAt != null && triggerAt > System.currentTimeMillis()) {
                schedule(reminder, triggerAt)
            } else {
                cancel(reminder.id)
            }
        }
    }

    fun schedule(reminder: ReminderDto, triggerAtMillis: Long) {
        val pending = pendingIntent(
            id = reminder.id,
            title = reminder.title,
            body = reminder.body,
            recurrence = reminder.recurrence,
            baseFireAt = reminder.fireAt,
        )
        val canExact = Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
            alarmManager.canScheduleExactAlarms()
        try {
            if (canExact) {
                alarmManager.setExactAndAllowWhileIdle(
                    AlarmManager.RTC_WAKEUP, triggerAtMillis, pending,
                )
            } else {
                alarmManager.setAndAllowWhileIdle(
                    AlarmManager.RTC_WAKEUP, triggerAtMillis, pending,
                )
            }
        } catch (e: SecurityException) {
            Log.w(TAG, "Exact alarm not permitted; falling back to inexact", e)
            alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pending)
        }
    }

    fun cancel(id: String) {
        alarmManager.cancel(
            pendingIntent(id, title = "", body = null, recurrence = null, baseFireAt = null),
        )
    }

    private fun eligible(r: ReminderDto): Boolean =
        r.triggerType == "TIME" && (r.status == "SCHEDULED" || r.status == "SNOOZED")

    private fun pendingIntent(
        id: String,
        title: String,
        body: String?,
        recurrence: String?,
        baseFireAt: String?,
    ): PendingIntent {
        val intent = Intent(context, ReminderAlarmReceiver::class.java).apply {
            action = ReminderAlarmReceiver.ACTION_FIRE
            // The id must be part of the data so distinct reminders get distinct PendingIntents
            // (extras are not used for PendingIntent equality).
            data = android.net.Uri.parse("nodeira://reminder/$id")
            putExtra(ReminderAlarmReceiver.EXTRA_ID, id)
            putExtra(ReminderAlarmReceiver.EXTRA_TITLE, title)
            putExtra(ReminderAlarmReceiver.EXTRA_BODY, body)
            putExtra(ReminderAlarmReceiver.EXTRA_RECURRENCE, recurrence)
            putExtra(ReminderAlarmReceiver.EXTRA_BASE_FIRE_AT, baseFireAt)
        }
        val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        return PendingIntent.getBroadcast(context, id.hashCode(), intent, flags)
    }

    companion object {
        private const val TAG = "ReminderScheduler"

        /** Next fire time: the snooze time if snoozed, else the (possibly recurring) fireAt. */
        fun triggerTimeMillis(r: ReminderDto): Long? {
            r.snoozeUntil?.let { return parseMillis(it) }
            val base = r.fireAt?.let { parseMillis(it) } ?: return null
            return if (r.recurrence.isNullOrBlank()) base else nextOccurrence(base, r.recurrence)
        }

        /** Parses an ISO-8601 instant (with `Z` or an offset) to epoch millis. */
        fun parseMillis(iso: String): Long? = try {
            Instant.parse(iso).toEpochMilli()
        } catch (_: Exception) {
            try {
                OffsetDateTime.parse(iso).toInstant().toEpochMilli()
            } catch (_: Exception) {
                null
            }
        }

        /** Advances [baseMillis] by the recurrence step until it is in the future. */
        fun nextOccurrence(baseMillis: Long, recurrence: String): Long {
            val zone = ZoneId.systemDefault()
            var dt = ZonedDateTime.ofInstant(Instant.ofEpochMilli(baseMillis), zone)
            val now = ZonedDateTime.now(zone)
            while (dt.isBefore(now)) {
                dt = when (recurrence) {
                    "DAILY" -> dt.plusDays(1)
                    "WEEKLY" -> dt.plusWeeks(1)
                    "MONTHLY" -> dt.plusMonths(1)
                    "YEARLY" -> dt.plusYears(1)
                    else -> return baseMillis
                }
            }
            return dt.toInstant().toEpochMilli()
        }
    }
}
