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
            timezone = reminder.timezone,
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
        // Extras play no part in PendingIntent equality — only the action, data and component
        // do — so the placeholders here still resolve to the alarm that was scheduled.
        alarmManager.cancel(
            pendingIntent(
                id,
                title = "",
                body = null,
                recurrence = null,
                baseFireAt = null,
                timezone = null,
            ),
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
        timezone: String?,
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
            putExtra(ReminderAlarmReceiver.EXTRA_TIMEZONE, timezone)
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
            return if (r.recurrence.isNullOrBlank()) {
                base
            } else {
                nextOccurrence(base, r.recurrence, zoneOf(r.timezone))
            }
        }

        /**
         * The reminder's own zone, falling back to the device's.
         *
         * `ReminderDto.timezone` was carried from the API and never read, so recurrence was
         * computed in whatever zone the phone was currently in. That is usually right and
         * quietly wrong for a traveller: a daily 09:00 reminder set at home starts firing at
         * 09:00 local wherever the phone has been carried to, which is not what was asked for.
         */
        fun zoneOf(timezone: String?): ZoneId {
            if (timezone.isNullOrBlank()) return ZoneId.systemDefault()
            return try {
                ZoneId.of(timezone)
            } catch (_: Exception) {
                Log.w(TAG, "Unknown reminder time zone \"$timezone\"; using the device zone")
                ZoneId.systemDefault()
            }
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

        /**
         * Advances [baseMillis] by the recurrence step until it is in the future, keeping the
         * wall-clock time in [zone].
         *
         * `ZonedDateTime.plusDays` preserves the local time across a DST transition (unlike
         * adding 24 hours to an instant), so the only thing that was wrong here was the zone.
         */
        fun nextOccurrence(
            baseMillis: Long,
            recurrence: String,
            zone: ZoneId = ZoneId.systemDefault(),
        ): Long {
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
