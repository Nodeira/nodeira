package com.deranjer.nodeira.data

import android.content.Context
import androidx.core.content.edit
import com.deranjer.nodeira.data.net.ReminderDto
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json

/**
 * Local snapshot of the reminder list, written on every sync. Lets [BootReceiver] re-register
 * alarms + geofences after a reboot (AlarmManager/proximity alerts don't survive reboot, and
 * the API isn't reachable that early).
 */
class ReminderCache(context: Context) {

    private val prefs = context.getSharedPreferences("nodeira_reminders_cache", Context.MODE_PRIVATE)
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }
    private val serializer = ListSerializer(ReminderDto.serializer())

    fun save(reminders: List<ReminderDto>) {
        prefs.edit { putString(KEY, json.encodeToString(serializer, reminders)) }
    }

    fun load(): List<ReminderDto> {
        val raw = prefs.getString(KEY, null) ?: return emptyList()
        return runCatching { json.decodeFromString(serializer, raw) }.getOrDefault(emptyList())
    }

    private companion object {
        const val KEY = "reminders"
    }
}
