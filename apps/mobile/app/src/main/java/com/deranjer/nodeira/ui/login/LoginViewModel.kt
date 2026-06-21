package com.deranjer.nodeira.ui.login

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.deranjer.nodeira.data.NodeiraRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class LoginUiState(
    val serverUrl: String = "",
    val email: String = "",
    val password: String = "",
    val loading: Boolean = false,
    val error: String? = null,
    val success: Boolean = false,
)

class LoginViewModel(
    private val repository: NodeiraRepository,
    initialServerUrl: String?,
) : ViewModel() {

    private val _state = MutableStateFlow(LoginUiState(serverUrl = initialServerUrl ?: ""))
    val state: StateFlow<LoginUiState> = _state.asStateFlow()

    fun onServerUrl(value: String) = _state.update { it.copy(serverUrl = value, error = null) }
    fun onEmail(value: String) = _state.update { it.copy(email = value, error = null) }
    fun onPassword(value: String) = _state.update { it.copy(password = value, error = null) }

    fun submit() {
        val s = _state.value
        if (s.serverUrl.isBlank() || s.email.isBlank() || s.password.isBlank()) {
            _state.update { it.copy(error = "Server, email and password are required") }
            return
        }
        _state.update { it.copy(loading = true, error = null) }
        viewModelScope.launch {
            try {
                repository.login(s.serverUrl.trim(), s.email.trim(), s.password)
                _state.update { it.copy(loading = false, success = true) }
            } catch (e: Exception) {
                _state.update {
                    it.copy(loading = false, error = e.message ?: "Login failed")
                }
            }
        }
    }
}
