package com.deranjer.nodeira.reminders

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.location.LocationManager

/**
 * Fired by [LocationGeofenceManager]'s proximity alert. Posts a notification on the relevant
 * transition (enter, or exit when the reminder is "notify on leave").
 */
class GeofenceReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != ACTION_GEOFENCE) return

        val entering = intent.getBooleanExtra(LocationManager.KEY_PROXIMITY_ENTERING, false)
        val onLeave = intent.getBooleanExtra(EXTRA_ON_LEAVE, false)
        val fire = if (onLeave) !entering else entering
        if (!fire) return

        val id = intent.getStringExtra(EXTRA_ID) ?: return
        val title = intent.getStringExtra(EXTRA_TITLE).orEmpty()
        val body = intent.getStringExtra(EXTRA_BODY)
        ReminderNotifications.show(context, id, title, body)
    }

    companion object {
        const val ACTION_GEOFENCE = "com.deranjer.nodeira.GEOFENCE"
        const val EXTRA_ID = "id"
        const val EXTRA_TITLE = "title"
        const val EXTRA_BODY = "body"
        const val EXTRA_ON_LEAVE = "onLeave"
    }
}
