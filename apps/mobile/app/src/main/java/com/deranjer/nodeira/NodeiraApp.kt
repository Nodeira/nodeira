package com.deranjer.nodeira

import android.app.Application
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.ProcessLifecycleOwner
import com.deranjer.nodeira.data.AuthStorage
import com.deranjer.nodeira.data.NodeiraRepository
import com.deranjer.nodeira.data.OfflineCache
import com.deranjer.nodeira.data.ReminderCache
import com.deranjer.nodeira.data.SettingsStorage
import com.deranjer.nodeira.data.net.NetworkModule
import com.deranjer.nodeira.data.net.ReminderSocket
import com.deranjer.nodeira.data.sync.WriteQueue
import com.deranjer.nodeira.reminders.LocationGeofenceManager
import com.deranjer.nodeira.reminders.ReminderScheduler
import com.deranjer.nodeira.reminders.ReminderSync
import com.deranjer.nodeira.reminders.ReminderSyncWorker

/**
 * Lightweight manual DI — an app-scoped container of singletons. Kept deliberately small
 * (no Hilt/kapt) for an app this size. Screens reach it via `application as NodeiraApp`.
 */
class NodeiraApp : Application() {

    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)

        // The notifications socket follows the *process* foreground state, not an Activity's.
        // Bound to an Activity it would drop and reconnect on every rotation, and bound to
        // nothing it would sit open in the background where Android will kill it anyway.
        ProcessLifecycleOwner.get().lifecycle.addObserver(
            object : DefaultLifecycleObserver {
                override fun onStart(owner: LifecycleOwner) {
                    container.onEnterForeground(this@NodeiraApp)
                }

                override fun onStop(owner: LifecycleOwner) {
                    container.reminderSocket.stop()
                }
            },
        )

        // Covers the already-logged-in launch; login calls this again once a session exists.
        if (container.authStorage.isLoggedIn) ReminderSyncWorker.enqueue(this)
    }
}

class AppContainer(app: NodeiraApp) {
    val authStorage = AuthStorage(app)
    val settingsStorage = SettingsStorage(app)
    val reminderScheduler = ReminderScheduler(app)
    val geofenceManager = LocationGeofenceManager(app)
    val reminderCache = ReminderCache(app)
    val offlineCache = OfflineCache(app)
    val writeQueue = WriteQueue(app)
    private val network = NetworkModule(authStorage)
    val repository = NodeiraRepository(authStorage, network, offlineCache, writeQueue)

    val reminderSync = ReminderSync(repository, reminderScheduler, geofenceManager, reminderCache)
    val reminderSocket = ReminderSocket(app, authStorage, network.webSocketClient)

    /** Emits when the API returns 401 (expired session) — the UI navigates to login. */
    val unauthorized = network.unauthorized

    /**
     * Connects the notifications socket for the current session. Called when the process is
     * foregrounded and again right after login, since the first foreground event of a cold
     * start arrives before there is a token to connect with.
     */
    fun onEnterForeground(app: Application) {
        if (!authStorage.isLoggedIn) return
        reminderSocket.start()
        ReminderSyncWorker.enqueue(app)
    }

    /** Tears down everything session-scoped. Call before clearing the token. */
    fun onLogout(app: Application) {
        reminderSocket.reset()
        ReminderSyncWorker.cancel(app)
    }
}
