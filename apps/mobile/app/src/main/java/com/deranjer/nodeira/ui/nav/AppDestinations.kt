package com.deranjer.nodeira.ui.nav

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Hub
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Settings
import androidx.compose.ui.graphics.vector.ImageVector

/** Top-level destinations shown in the navigation drawer. */
enum class AppDestination(
    val route: String,
    val label: String,
    val icon: ImageVector,
) {
    HOME("home", "Home", Icons.Filled.Home),
    RECENTS("recents", "Recents", Icons.Filled.Schedule),
    QUICK_NOTES("quicknotes", "Quick notes", Icons.Filled.Bolt),
    CANVASES("canvases", "Canvases", Icons.Filled.Dashboard),
    GRAPH("graph", "Graph", Icons.Filled.Hub),
    REMINDERS("reminders", "Reminders", Icons.Filled.Notifications),
    SETTINGS("settings", "Settings", Icons.Filled.Settings);

    companion object {
        fun fromRoute(route: String?): AppDestination? = entries.firstOrNull { it.route == route }

        /** Primary destinations shown in the Material 3 bottom navigation bar. */
        val bottomNav = listOf(HOME, RECENTS, QUICK_NOTES, REMINDERS)

        /** Secondary destinations reached from the navigation drawer (menu icon). */
        val drawerOnly = listOf(CANVASES, GRAPH, SETTINGS)
    }
}

const val ROUTE_LOGIN = "login"
