package com.deranjer.nodeira.ui.nav

import android.Manifest
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import java.util.concurrent.atomic.AtomicBoolean

/** Guards against re-prompting on every screen entry within one process. */
private val requested = AtomicBoolean(false)

/**
 * Asks for POST_NOTIFICATIONS (Android 13+) once the user is inside the app.
 *
 * This used to live on the reminders screen alone, which was fine while that screen was also
 * the only thing that ever scheduled an alarm. It is not fine any more: the notifications
 * socket and the background sync both post notifications now, so a user who never opened
 * Reminders had a phone that received reminders correctly and dropped every one of them —
 * `ReminderNotifications` checks `areNotificationsEnabled()` and returns quietly. That failure
 * is invisible from the outside, which is exactly the kind worth designing out.
 */
@Composable
fun RequestNotificationPermission() {
    val launcher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { /* Denial is survivable: reminders still fire, they just don't show. */ }

    LaunchedEffect(Unit) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            requested.compareAndSet(false, true)
        ) {
            launcher.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }
}
