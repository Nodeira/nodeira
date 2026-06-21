package com.deranjer.nodeira.reminders

import android.Manifest
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.LocationManager
import android.net.Uri
import androidx.core.content.ContextCompat
import com.deranjer.nodeira.data.net.ReminderDto

/**
 * Registers LOCATION reminders as platform proximity alerts
 * ([LocationManager.addProximityAlert]). This works without Google Play Services / microG —
 * important for the F-Droid audience (the old RN app's geofences relied on Play Services).
 *
 * Requires ACCESS_FINE_LOCATION; ACCESS_BACKGROUND_LOCATION for firing when the app is closed.
 */
class LocationGeofenceManager(private val context: Context) {

    private val locationManager =
        context.getSystemService(Context.LOCATION_SERVICE) as LocationManager

    private fun hasLocationPermission(): Boolean =
        ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED

    /** (Re)registers eligible LOCATION reminders and removes the rest. */
    @Suppress("DEPRECATION")
    fun sync(reminders: List<ReminderDto>) {
        if (!hasLocationPermission()) return
        reminders.forEach { r ->
            removeFor(r.id)
            if (eligible(r)) {
                locationManager.addProximityAlert(
                    r.lat!!,
                    r.lng!!,
                    r.radiusM!!.toFloat(),
                    -1L, // never expires
                    pendingIntent(r.id, r.title, r.body, r.onLeave),
                )
            }
        }
    }

    @Suppress("DEPRECATION")
    fun removeFor(id: String) {
        locationManager.removeProximityAlert(pendingIntent(id, "", null, false))
    }

    private fun eligible(r: ReminderDto): Boolean =
        r.triggerType == "LOCATION" &&
            (r.status == "SCHEDULED" || r.status == "SNOOZED") &&
            r.lat != null && r.lng != null && r.radiusM != null

    private fun pendingIntent(
        id: String,
        title: String,
        body: String?,
        onLeave: Boolean,
    ): PendingIntent {
        val intent = Intent(context, GeofenceReceiver::class.java).apply {
            action = GeofenceReceiver.ACTION_GEOFENCE
            data = Uri.parse("nodeira://geofence/$id")
            putExtra(GeofenceReceiver.EXTRA_ID, id)
            putExtra(GeofenceReceiver.EXTRA_TITLE, title)
            putExtra(GeofenceReceiver.EXTRA_BODY, body)
            putExtra(GeofenceReceiver.EXTRA_ON_LEAVE, onLeave)
        }
        return PendingIntent.getBroadcast(
            context,
            id.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }
}
