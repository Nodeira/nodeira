package com.deranjer.nodeira.data

import android.content.Context
import androidx.core.content.edit

/** Local app preferences (startup view, etc.). Server-synced prefs are a follow-up. */
class SettingsStorage(context: Context) {

    private val prefs = context.getSharedPreferences("nodeira_settings", Context.MODE_PRIVATE)

    /** Route name of the screen to open on launch; defaults to Home. */
    var startupRoute: String
        get() = prefs.getString(KEY_STARTUP, "home") ?: "home"
        set(value) = prefs.edit { putString(KEY_STARTUP, value) }

    private companion object {
        const val KEY_STARTUP = "startup_route"
    }
}
