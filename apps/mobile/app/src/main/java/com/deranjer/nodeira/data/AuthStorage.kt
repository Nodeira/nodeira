package com.deranjer.nodeira.data

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import androidx.core.content.edit
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/**
 * Persists the session: server base URL + JWT (+ basic user info).
 *
 * The JWT is stored in EncryptedSharedPreferences, backed by a Keystore master key. It used
 * to sit in plain app-private SharedPreferences, which is readable on a rooted device or
 * out of a backup — and it is a long-lived bearer token for every note the user can reach.
 *
 * A one-time migration moves any existing plaintext session across, so upgrading users are
 * not logged out. If the encrypted store cannot be opened at all (a Keystore that has been
 * invalidated, for instance) the app falls back to plaintext rather than becoming unusable,
 * and says so in the log.
 *
 * The JWT and server URL are also what the editor WebView needs injected, so the editor is
 * launched straight from here rather than from a throwaway form.
 */
class AuthStorage(context: Context) {

    private val prefs: SharedPreferences = openEncrypted(context) ?: openPlaintext(context)

    init {
        migrateLegacyPlaintext(context)
    }

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

    /** Moves a pre-encryption session into the encrypted store exactly once, then wipes it. */
    private fun migrateLegacyPlaintext(context: Context) {
        val legacy = context.getSharedPreferences(LEGACY_PREFS, Context.MODE_PRIVATE)
        if (legacy.all.isEmpty()) return
        // Nothing to do if this instance *is* the plaintext store (encryption unavailable).
        if (prefs === legacy) return

        prefs.edit {
            legacy.getString(KEY_SERVER, null)?.let { putString(KEY_SERVER, it) }
            legacy.getString(KEY_TOKEN, null)?.let { putString(KEY_TOKEN, it) }
            legacy.getString(KEY_EMAIL, null)?.let { putString(KEY_EMAIL, it) }
        }
        legacy.edit { clear() }
        Log.i(TAG, "Migrated session from plaintext preferences into the encrypted store")
    }

    private companion object {
        const val TAG = "AuthStorage"
        const val LEGACY_PREFS = "nodeira_auth"
        const val ENCRYPTED_PREFS = "nodeira_auth_secure"
        const val KEY_SERVER = "server_url"
        const val KEY_TOKEN = "token"
        const val KEY_EMAIL = "email"

        fun openEncrypted(context: Context): SharedPreferences? = runCatching {
            val masterKey = MasterKey.Builder(context)
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                .build()
            EncryptedSharedPreferences.create(
                context,
                ENCRYPTED_PREFS,
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
            )
        }.onFailure {
            Log.w(TAG, "Encrypted preferences unavailable; falling back to plaintext", it)
        }.getOrNull()

        fun openPlaintext(context: Context): SharedPreferences =
            context.getSharedPreferences(LEGACY_PREFS, Context.MODE_PRIVATE)
    }
}
