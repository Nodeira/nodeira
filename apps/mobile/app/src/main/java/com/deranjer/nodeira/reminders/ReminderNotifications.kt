package com.deranjer.nodeira.reminders

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.deranjer.nodeira.MainActivity
import com.deranjer.nodeira.R

/** Shared reminder-notification posting, used by the time-alarm and geofence receivers. */
object ReminderNotifications {

    private const val CHANNEL_ID = "reminders"

    fun show(context: Context, id: String, title: String, body: String?) {
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            manager.createNotificationChannel(
                NotificationChannel(CHANNEL_ID, "Reminders", NotificationManager.IMPORTANCE_HIGH)
                    .apply { description = "Note reminders" },
            )
        }

        val tapIntent = PendingIntent.getActivity(
            context,
            id.hashCode(),
            Intent(context, MainActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_reminder)
            .setContentTitle(title.ifBlank { "Reminder" })
            .apply { if (!body.isNullOrBlank()) setContentText(body) }
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(tapIntent)
            .build()

        val nm = NotificationManagerCompat.from(context)
        if (nm.areNotificationsEnabled()) {
            nm.notify(id.hashCode(), notification)
        }
    }
}
