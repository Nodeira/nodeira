package com.deranjer.nodeira.data.net

import kotlinx.serialization.Serializable

/**
 * Reminder as returned by the API. Enums are kept as the server's string constants
 * (TIME/LOCATION, NONE/NOTE/…, DAILY/WEEKLY/…, SCHEDULED/…). `ignoreUnknownKeys` drops
 * fields the native app doesn't use yet.
 */
@Serializable
data class ReminderDto(
    val id: String,
    val title: String = "",
    val body: String? = null,
    val targetType: String = "NONE",
    val targetNoteId: String? = null,
    val triggerType: String = "TIME",
    val fireAt: String? = null,
    val timezone: String? = null,
    val recurrence: String? = null,
    val lat: Double? = null,
    val lng: Double? = null,
    val radiusM: Double? = null,
    val locationName: String? = null,
    val onLeave: Boolean = false,
    val status: String = "SCHEDULED",
    val snoozeUntil: String? = null,
    val createdAt: String? = null,
    val updatedAt: String? = null,
)

@Serializable
data class CreateReminderBody(
    val title: String,
    val body: String? = null,
    val targetType: String = "NONE",
    val targetNoteId: String? = null,
    val triggerType: String = "TIME",
    val fireAt: String? = null,
    val timezone: String? = null,
    val recurrence: String? = null,
    val lat: Double? = null,
    val lng: Double? = null,
    val radiusM: Double? = null,
    val locationName: String? = null,
    val onLeave: Boolean? = null,
)
