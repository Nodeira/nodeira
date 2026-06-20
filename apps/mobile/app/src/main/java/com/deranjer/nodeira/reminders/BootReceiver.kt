package com.deranjer.nodeira.reminders

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.deranjer.nodeira.data.ReminderCache

/**
 * Re-registers reminders after a reboot. AlarmManager alarms + proximity alerts are cleared
 * on reboot, and the API isn't reachable that early, so we replay from [ReminderCache].
 */
class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        val reminders = ReminderCache(context).load()
        if (reminders.isEmpty()) return
        ReminderScheduler(context).sync(reminders)
        LocationGeofenceManager(context).sync(reminders)
    }
}
