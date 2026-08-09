package com.deranjer.nodeira.data.net

import android.content.Context
import android.net.Uri
import android.util.Log
import com.deranjer.nodeira.data.AuthStorage
import com.deranjer.nodeira.reminders.ReminderNotifications
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import kotlin.math.min

/**
 * Client for the server's `/notifications` WebSocket, which pushes a message whenever one of
 * the user's reminders fires.
 *
 * Why the phone needs this at all, given it already fires reminders itself: [ReminderScheduler]
 * can only set an alarm for a reminder the phone has seen. One created on the web or desktop
 * client is unknown here until something syncs, so nothing fires. This socket both delivers
 * the notification live and is a signal to re-sync — see the event emitted on [events].
 *
 * It is deliberately *not* a background service. The socket runs while the app is in the
 * foreground; delivery for a closed app is [ReminderSyncWorker]'s job, which schedules real
 * alarms rather than trying to hold a socket open through Doze.
 *
 * Notifications are posted through [ReminderNotifications], whose notification id is
 * `reminderId.hashCode()`. That is what keeps a socket push and a local alarm for the same
 * reminder from showing up twice: the second post replaces the first.
 */
class ReminderSocket(
    private val context: Context,
    private val auth: AuthStorage,
    private val client: OkHttpClient,
) {

    private val json = Json { ignoreUnknownKeys = true }

    private val _events = MutableSharedFlow<ReminderNotificationDto>(extraBufferCapacity = 8)
    /** Emits each fired reminder, so open screens can refresh their list. */
    val events: SharedFlow<ReminderNotificationDto> = _events

    private var scope: CoroutineScope? = null
    private var socket: WebSocket? = null
    private var reconnectJob: Job? = null
    private var attempt = 0
    /** Set when the server rejects the token; stops the reconnect loop from hammering it. */
    private var refused = false

    /**
     * Opens the socket if a session exists. Safe to call repeatedly — on every foreground
     * event and again after login.
     *
     * The guard is on the *socket*, not the scope. Guarding on the scope meant that a
     * connection refused for a stale token (which sets [refused] and leaves the scope alive)
     * could never be retried: every later `start()` returned early, so signing in again gave
     * a session with no notifications until the process was killed. Each explicit start is a
     * new attempt with whatever token is current, so [refused] clears here.
     */
    @Synchronized
    fun start() {
        if (!auth.isLoggedIn) return
        if (socket != null) return
        refused = false
        attempt = 0
        reconnectJob?.cancel()
        reconnectJob = null
        if (scope == null) scope = CoroutineScope(SupervisorJob())
        connect()
    }

    /** Closes the socket and cancels any pending reconnect. */
    @Synchronized
    fun stop() {
        reconnectJob?.cancel()
        reconnectJob = null
        socket?.close(NORMAL_CLOSURE, null)
        socket = null
        scope?.cancel()
        scope = null
    }

    /** Drops the session's socket. Call on logout, before the token is cleared. */
    fun reset() {
        stop()
        refused = false
        attempt = 0
    }

    private fun connect() {
        val url = socketUrl() ?: return
        val request = Request.Builder().url(url).build()
        socket = client.newWebSocket(request, Listener())
    }

    private fun socketUrl(): String? {
        val server = auth.serverUrl?.trimEnd('/') ?: return null
        val token = auth.token ?: return null
        val ws = when {
            server.startsWith("https://") -> "wss://" + server.removePrefix("https://")
            server.startsWith("http://") -> "ws://" + server.removePrefix("http://")
            else -> return null
        }
        return "$ws/notifications?token=${Uri.encode(token)}"
    }

    private fun scheduleReconnect() {
        val activeScope = scope ?: return
        if (refused) return
        reconnectJob?.cancel()
        // 2s, 4s, 8s … capped at 60s. The server being down is the common case here, and a
        // phone retrying every second in a pocket is a battery bug.
        val delayMs = min(MAX_BACKOFF_MS, BASE_BACKOFF_MS shl min(attempt, 5))
        attempt++
        reconnectJob = activeScope.launch {
            delay(delayMs)
            synchronized(this@ReminderSocket) {
                if (scope != null) connect()
            }
        }
    }

    private inner class Listener : WebSocketListener() {

        override fun onOpen(webSocket: WebSocket, response: Response) {
            Log.i(TAG, "Notifications socket open")
            attempt = 0
        }

        override fun onMessage(webSocket: WebSocket, text: String) {
            val envelope = runCatching { json.decodeFromString<NotificationEnvelope>(text) }
                .getOrElse {
                    Log.w(TAG, "Ignoring unparseable notification: $text")
                    return
                }
            if (envelope.type != TYPE_REMINDER) return
            val payload = envelope.payload ?: return

            ReminderNotifications.show(
                context = context,
                id = payload.reminderId,
                title = payload.title.ifBlank { "Reminder" },
                body = payload.body,
            )
            _events.tryEmit(payload)
        }

        override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
            // The gateway closes with 1008 when the token is missing or invalid. Retrying
            // that only produces a rejected handshake every few seconds until the app is
            // killed; the REST layer will surface the expired session on its next 401.
            if (code == POLICY_VIOLATION) {
                Log.w(TAG, "Notifications socket refused: $reason")
                refused = true
            }
            webSocket.close(NORMAL_CLOSURE, null)
        }

        override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
            if (socket === webSocket) socket = null
            if (code != NORMAL_CLOSURE) scheduleReconnect()
        }

        override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
            // Ordinary offline/asleep churn, not something to show the user.
            Log.d(TAG, "Notifications socket failed: ${t.message}")
            if (socket === webSocket) socket = null
            scheduleReconnect()
        }
    }

    private companion object {
        const val TAG = "ReminderSocket"
        const val TYPE_REMINDER = "reminder"
        const val NORMAL_CLOSURE = 1000
        const val POLICY_VIOLATION = 1008
        const val BASE_BACKOFF_MS = 2_000L
        const val MAX_BACKOFF_MS = 60_000L
    }
}
