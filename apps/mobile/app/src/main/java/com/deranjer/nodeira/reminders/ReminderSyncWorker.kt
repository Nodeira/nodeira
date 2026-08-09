package com.deranjer.nodeira.reminders

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.deranjer.nodeira.NodeiraApp
import java.util.concurrent.TimeUnit

/**
 * Periodically pulls the reminder list and re-registers alarms and geofences from it.
 *
 * This is what makes a reminder created on the web or desktop client actually fire on the
 * phone. The notifications socket only runs while the app is foregrounded, and holding a
 * socket open in the background would mean a foreground service and a permanent notification
 * for something Android already does well: [ReminderScheduler] sets a real alarm, and an
 * alarm fires through Doze whether or not the app is running. The only thing missing was
 * something to *learn about* the reminder, which is this.
 *
 * Cadence is a compromise. WorkManager will not run a periodic job more often than every 15
 * minutes and defers it under Doze regardless, so a reminder created elsewhere and due within
 * the hour may still be delivered by the socket instead (or on next app open). Reminders set
 * further out — the overwhelming majority — get their alarm well before they are due.
 */
class ReminderSyncWorker(
    context: Context,
    params: WorkerParameters,
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val container = (applicationContext as NodeiraApp).container
        // Logging out cancels this work, but a run already in flight can still land after.
        if (!container.authStorage.isLoggedIn) return Result.success()

        // Retry rather than fail: the usual cause is no connectivity, and WorkManager backs
        // off on its own. Failure would drop the periodic chain entirely.
        return if (container.reminderSync.runQuietly()) Result.success() else Result.retry()
    }

    companion object {
        private const val WORK_NAME = "reminder-sync"
        private const val INTERVAL_MINUTES = 30L

        /** Starts the periodic sync. Idempotent — an existing schedule is left running. */
        fun enqueue(context: Context) {
            val request = PeriodicWorkRequestBuilder<ReminderSyncWorker>(
                INTERVAL_MINUTES,
                TimeUnit.MINUTES,
            )
                .setConstraints(
                    Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build(),
                )
                .build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME,
                // KEEP, not UPDATE: replacing the request on every app start would reset the
                // period each time and the job would rarely come due.
                ExistingPeriodicWorkPolicy.KEEP,
                request,
            )
        }

        fun cancel(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
        }
    }
}
