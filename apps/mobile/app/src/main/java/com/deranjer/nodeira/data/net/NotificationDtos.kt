package com.deranjer.nodeira.data.net

import kotlinx.serialization.Serializable

/**
 * Envelope pushed over the /notifications WebSocket. The server sends
 * `{"type":"reminder","payload":{…}}`; `type` is matched rather than assumed, so a future
 * message kind is ignored instead of being mistaken for a reminder.
 */
@Serializable
data class NotificationEnvelope(
    val type: String = "",
    val payload: ReminderNotificationDto? = null,
)

/** Mirrors `ReminderNotification` in packages/shared-types. */
@Serializable
data class ReminderNotificationDto(
    val reminderId: String,
    val title: String = "",
    val body: String? = null,
    val targetType: String = "NONE",
    val targetNoteId: String? = null,
    val targetCanvasId: String? = null,
    val targetNodeId: String? = null,
    val firedAt: String? = null,
)
