package com.deranjer.nodeira

import android.app.Application
import com.deranjer.nodeira.data.AuthStorage
import com.deranjer.nodeira.data.NodeiraRepository
import com.deranjer.nodeira.data.OfflineCache
import com.deranjer.nodeira.data.ReminderCache
import com.deranjer.nodeira.data.SettingsStorage
import com.deranjer.nodeira.data.net.NetworkModule
import com.deranjer.nodeira.reminders.LocationGeofenceManager
import com.deranjer.nodeira.reminders.ReminderScheduler

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
    }
}

class AppContainer(app: NodeiraApp) {
    val authStorage = AuthStorage(app)
    val settingsStorage = SettingsStorage(app)
    val reminderScheduler = ReminderScheduler(app)
    val geofenceManager = LocationGeofenceManager(app)
    val reminderCache = ReminderCache(app)
    val offlineCache = OfflineCache(app)
    private val network = NetworkModule(authStorage)
    val repository = NodeiraRepository(authStorage, network, offlineCache)

    /** Emits when the API returns 401 (expired session) — the UI navigates to login. */
    val unauthorized = network.unauthorized
}
