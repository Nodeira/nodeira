package com.deranjer.nodeira.ui.reminders

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.deranjer.nodeira.data.NodeiraRepository
import com.deranjer.nodeira.data.net.CreateReminderBody
import com.deranjer.nodeira.data.net.ReminderDto
import com.deranjer.nodeira.data.net.ReminderSocket
import com.deranjer.nodeira.reminders.LocationGeofenceManager
import com.deranjer.nodeira.reminders.ReminderScheduler
import com.deranjer.nodeira.reminders.ReminderSync
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.ZoneId

data class RemindersUiState(
    val loading: Boolean = true,
    val reminders: List<ReminderDto> = emptyList(),
    val error: String? = null,
)

class RemindersViewModel(
    private val repository: NodeiraRepository,
    private val scheduler: ReminderScheduler,
    private val geofences: LocationGeofenceManager,
    private val sync: ReminderSync,
    socket: ReminderSocket,
) : ViewModel() {

    private val _state = MutableStateFlow(RemindersUiState())
    val state: StateFlow<RemindersUiState> = _state.asStateFlow()

    init {
        refresh()

        // A reminder firing means the server changed its status (and, for a recurring one,
        // its next fire time), so the open list is now stale. The socket has already posted
        // the notification; this only brings the screen back in line.
        viewModelScope.launch {
            socket.events.collect { refresh() }
        }
    }

    fun refresh() {
        _state.update { it.copy(loading = true, error = null) }
        viewModelScope.launch {
            try {
                // Fetches, then (re)registers time alarms + location geofences and caches
                // the list for reboot replay — the same path the background worker takes.
                val reminders = sync.run()
                _state.update { it.copy(loading = false, reminders = reminders) }
            } catch (e: Exception) {
                _state.update { it.copy(loading = false, error = e.message ?: "Failed to load reminders") }
            }
        }
    }

    /** Creates a one-shot/recurring TIME reminder and reschedules. */
    fun createTimeReminder(
        title: String,
        body: String?,
        fireAtMillis: Long,
        recurrence: String?,
        onDone: () -> Unit,
    ) = create(
        CreateReminderBody(
            title = title.trim(),
            body = body?.trim()?.ifBlank { null },
            targetType = "NONE",
            triggerType = "TIME",
            fireAt = Instant.ofEpochMilli(fireAtMillis).toString(),
            timezone = ZoneId.systemDefault().id,
            recurrence = recurrence,
        ),
        onDone,
    )

    /** Creates a LOCATION (geofence) reminder. */
    fun createLocationReminder(
        title: String,
        body: String?,
        lat: Double,
        lng: Double,
        radiusM: Int,
        locationName: String?,
        onLeave: Boolean,
        onDone: () -> Unit,
    ) = create(
        CreateReminderBody(
            title = title.trim(),
            body = body?.trim()?.ifBlank { null },
            targetType = "NONE",
            triggerType = "LOCATION",
            lat = lat,
            lng = lng,
            radiusM = radiusM.toDouble(),
            locationName = locationName?.trim()?.ifBlank { null },
            onLeave = onLeave,
        ),
        onDone,
    )

    private fun create(body: CreateReminderBody, onDone: () -> Unit) {
        viewModelScope.launch {
            try {
                repository.createReminder(body)
                refresh()
                onDone()
            } catch (e: Exception) {
                _state.update { it.copy(error = e.message ?: "Failed to create reminder") }
            }
        }
    }

    fun delete(id: String) {
        viewModelScope.launch {
            try {
                repository.deleteReminder(id)
                scheduler.cancel(id)
                geofences.removeFor(id)
                refresh()
            } catch (e: Exception) {
                _state.update { it.copy(error = e.message ?: "Failed to delete reminder") }
            }
        }
    }
}
