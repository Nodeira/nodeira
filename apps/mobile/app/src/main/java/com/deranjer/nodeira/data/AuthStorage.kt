package com.deranjer.nodeira.data

import android.content.Context
import androidx.core.content.edit

/**
 * Persists the session: server base URL + JWT (+ basic user info). App-private
 * SharedPreferences; encryption (EncryptedSharedPreferences / Keystore) is a follow-up.
 *
 * The JWT and server URL are also what the editor WebView needs injected, so the editor is
 * launched straight from here rather than from a throwaway form.
 */
class AuthStorage(context: Context) {

    private val prefs = context.getSharedPreferences("nodeira_auth", Context.MODE_PRIVATE)

    var serverUrl: String?
        get() = prefs.getString(KEY_SERVER, null)
        set(value) = prefs.edit { putString(KEY_SERVER, value?.trimEnd('/')) }

    var token: String?
        get() = prefs.getString(KEY_TOKEN, null)
        set(value) = prefs.edit { putString(KEY_TOKEN, value) }

    var userEmail: String?
        get() = prefs.getString(KEY_EMAIL, null)
        set(value) = prefs.edit { putString(KEY_EMAIL, value) }

    val isLoggedIn: Boolean
        get() = !token.isNullOrBlank() && !serverUrl.isNullOrBlank()

    fun clearSession() = prefs.edit {
        remove(KEY_TOKEN)
        remove(KEY_EMAIL)
        // Keep serverUrl so the user doesn't retype it on next login.
    }

    private companion object {
        const val KEY_SERVER = "server_url"
        const val KEY_TOKEN = "token"
        const val KEY_EMAIL = "email"
    }
}
