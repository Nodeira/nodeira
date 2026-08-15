package com.deranjer.nodeira

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import androidx.navigation.NavController
import androidx.navigation.NavGraphBuilder
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.navigation
import androidx.navigation.compose.rememberNavController
import com.deranjer.nodeira.editor.EditorWebViewActivity
import com.deranjer.nodeira.ui.canvases.CanvasesScreen
import com.deranjer.nodeira.ui.canvases.CanvasesViewModel
import com.deranjer.nodeira.ui.graph.GraphScreen
import com.deranjer.nodeira.ui.graph.GraphViewModel
import com.deranjer.nodeira.ui.home.HomeScreen
import com.deranjer.nodeira.ui.login.LoginScreen
import com.deranjer.nodeira.ui.login.LoginViewModel
import com.deranjer.nodeira.ui.nav.AppDestination
import com.deranjer.nodeira.ui.nav.ROUTE_LOGIN
import com.deranjer.nodeira.ui.notes.NotesViewModel
import com.deranjer.nodeira.ui.quicknotes.QuickNotesScreen
import com.deranjer.nodeira.ui.recents.RecentsScreen
import com.deranjer.nodeira.ui.reminders.ReminderEditorScreen
import com.deranjer.nodeira.ui.reminders.RemindersScreen
import com.deranjer.nodeira.ui.reminders.RemindersViewModel
import com.deranjer.nodeira.ui.settings.SettingsScreen
import com.deranjer.nodeira.ui.theme.NodeiraTheme

private const val ROUTE_MAIN = "main"
private const val ROUTE_REMINDER_EDITOR = "reminder_editor"

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            NodeiraTheme {
                NodeiraNavHost()
            }
        }
    }
}

@Composable
private fun NodeiraNavHost() {
    val navController = rememberNavController()
    val container = (LocalContext.current.applicationContext as NodeiraApp).container

    val start = if (container.authStorage.isLoggedIn) ROUTE_MAIN else ROUTE_LOGIN

    // On 401 (expired token), the session is cleared by the network layer; route to login.
    androidx.compose.runtime.LaunchedEffect(Unit) {
        container.unauthorized.collect {
            if (navController.currentDestination?.route != ROUTE_LOGIN) {
                navController.navigate(ROUTE_LOGIN) {
                    popUpTo(ROUTE_MAIN) { inclusive = true }
                    launchSingleTop = true
                }
            }
        }
    }

    NavHost(navController = navController, startDestination = start) {
        composable(ROUTE_LOGIN) {
            val vm: LoginViewModel = viewModel(
                factory = viewModelFactory {
                    initializer {
                        LoginViewModel(container.repository, container.authStorage.serverUrl)
                    }
                },
            )
            val appContext = LocalContext.current.applicationContext
            LoginScreen(
                viewModel = vm,
                onLoggedIn = {
                    // The process was already foregrounded when the app started, so the
                    // lifecycle observer's onStart fired before a token existed. Connect now.
                    container.onEnterForeground(appContext as android.app.Application)
                    navController.navigate(ROUTE_MAIN) {
                        popUpTo(ROUTE_LOGIN) { inclusive = true }
                    }
                },
            )
        }

        authenticatedGraph(navController, container)
    }
}

/** Authenticated subgraph — note screens share one [NotesViewModel]; reminder screens share one [RemindersViewModel]. */
private fun NavGraphBuilder.authenticatedGraph(
    navController: NavController,
    container: AppContainer,
) {
    val startRoute = AppDestination.fromRoute(container.settingsStorage.startupRoute)?.route
        ?: AppDestination.HOME.route

    navigation(startDestination = startRoute, route = ROUTE_MAIN) {

        composable(AppDestination.HOME.route) {
            val vm = sharedNotesViewModel(navController, container)
            val state by vm.state.collectAsStateWithLifecycle()
            HomeScreen(
                state = state,
                userInitial = container.authStorage.userEmail?.firstOrNull()?.uppercase() ?: "N",
                onOpenNote = { openNote(navController, container, it) },
                onNavigate = { navController.navigateTopLevel(it) },
                onLogout = { logout(navController, container) },
                onRefresh = vm::refresh,
                onCreateNote = { type, vaultId, onCreated -> vm.createNote(type, vaultId, onCreated) },
                onDeleteNote = { id -> vm.deleteNote(id) },
                onTogglePin = { id, pinned -> vm.setNotePinned(id, pinned) },
                onRenameNote = { id, title -> vm.renameNote(id, title) },
                onCreateFolder = { name, vaultId -> vm.createFolder(name, vaultId) },
                onResolveConflict = { opId, keepLocal -> vm.resolveConflict(opId, keepLocal) },
            )
        }

        composable(AppDestination.RECENTS.route) {
            val vm = sharedNotesViewModel(navController, container)
            val state by vm.state.collectAsStateWithLifecycle()
            RecentsScreen(
                state = state,
                onOpenNote = { openNote(navController, container, it) },
                onNavigate = { navController.navigateTopLevel(it) },
                onLogout = { logout(navController, container) },
                onCreateNote = { onCreated -> vm.createNote("note", null, onCreated) },
                onDeleteNote = { id -> vm.deleteNote(id) },
                onTogglePin = { id, pinned -> vm.setNotePinned(id, pinned) },
                onRenameNote = { id, title -> vm.renameNote(id, title) },
            )
        }

        composable(AppDestination.QUICK_NOTES.route) {
            val vm = sharedNotesViewModel(navController, container)
            val state by vm.state.collectAsStateWithLifecycle()
            QuickNotesScreen(
                state = state,
                onOpenNote = { openNote(navController, container, it) },
                onNavigate = { navController.navigateTopLevel(it) },
                onLogout = { logout(navController, container) },
                onCreateNote = { onCreated -> vm.createNote("quick", null, onCreated) },
            )
        }

        composable(AppDestination.CANVASES.route) {
            val vm = sharedViewModel(navController, "canvases") {
                CanvasesViewModel(container.repository)
            }
            CanvasesScreen(
                viewModel = vm,
                onOpenCanvas = { openCanvas(navController, container, it) },
                onNavigate = { navController.navigateTopLevel(it) },
                onLogout = { logout(navController, container) },
            )
        }

        composable(AppDestination.GRAPH.route) {
            val vm = sharedViewModel(navController, "graph") {
                GraphViewModel(container.repository)
            }
            GraphScreen(
                viewModel = vm,
                onOpenNote = { openNote(navController, container, it) },
                onNavigate = { navController.navigateTopLevel(it) },
                onLogout = { logout(navController, container) },
            )
        }

        composable(AppDestination.REMINDERS.route) {
            val vm = sharedRemindersViewModel(navController, container)
            RemindersScreen(
                viewModel = vm,
                onAddReminder = { navController.navigate(ROUTE_REMINDER_EDITOR) },
                onNavigate = { navController.navigateTopLevel(it) },
                onLogout = { logout(navController, container) },
            )
        }

        composable(ROUTE_REMINDER_EDITOR) {
            val vm = sharedRemindersViewModel(navController, container)
            ReminderEditorScreen(
                viewModel = vm,
                onDone = { navController.popBackStack() },
                onCancel = { navController.popBackStack() },
            )
        }

        composable(AppDestination.SETTINGS.route) {
            val context = LocalContext.current
            var startupRoute by remember { mutableStateOf(container.settingsStorage.startupRoute) }
            val appVersion = remember {
                runCatching {
                    context.packageManager.getPackageInfo(context.packageName, 0).versionName
                }.getOrNull() ?: "—"
            }
            SettingsScreen(
                serverUrl = container.authStorage.serverUrl ?: "—",
                userEmail = container.authStorage.userEmail ?: "—",
                appVersion = appVersion,
                startupRoute = startupRoute,
                onStartupRouteChange = {
                    container.settingsStorage.startupRoute = it
                    startupRoute = it
                },
                onNavigate = { navController.navigateTopLevel(it) },
                onLogout = { logout(navController, container) },
            )
        }
    }
}

/** Same [NotesViewModel] instance for every destination in the [ROUTE_MAIN] graph. */
@Composable
private fun sharedNotesViewModel(
    navController: NavController,
    container: AppContainer,
): NotesViewModel {
    val parentEntry = remember(navController.currentBackStackEntry) {
        navController.getBackStackEntry(ROUTE_MAIN)
    }
    return viewModel(
        viewModelStoreOwner = parentEntry,
        factory = viewModelFactory { initializer { NotesViewModel(container.repository) } },
    )
}

/** Same [RemindersViewModel] for the reminders list + editor. */
@Composable
private fun sharedRemindersViewModel(
    navController: NavController,
    container: AppContainer,
): RemindersViewModel {
    val parentEntry = remember(navController.currentBackStackEntry) {
        navController.getBackStackEntry(ROUTE_MAIN)
    }
    return viewModel(
        viewModelStoreOwner = parentEntry,
        factory = viewModelFactory {
            initializer {
                RemindersViewModel(
                    container.repository,
                    container.reminderScheduler,
                    container.geofenceManager,
                    container.reminderSync,
                    container.reminderSocket,
                )
            }
        },
    )
}

/** A ViewModel scoped to the [ROUTE_MAIN] graph (shared across its destinations). */
@Composable
private inline fun <reified T : ViewModel> sharedViewModel(
    navController: NavController,
    key: String,
    crossinline create: () -> T,
): T {
    val parentEntry = remember(navController.currentBackStackEntry) {
        navController.getBackStackEntry(ROUTE_MAIN)
    }
    return viewModel(
        viewModelStoreOwner = parentEntry,
        key = key,
        factory = viewModelFactory { initializer { create() } },
    )
}

private fun NavController.navigateTopLevel(route: String) {
    navigate(route) {
        popUpTo(AppDestination.HOME.route) { saveState = true }
        launchSingleTop = true
        restoreState = true
    }
}

private fun openEmbed(navController: NavController, container: AppContainer, path: String) {
    val auth = container.authStorage
    val server = auth.serverUrl ?: return
    val token = auth.token ?: return
    val context = navController.context
    context.startActivity(EditorWebViewActivity.intent(context, server, token, path))
}

private fun openNote(navController: NavController, container: AppContainer, noteId: String) =
    openEmbed(navController, container, EditorWebViewActivity.notePath(noteId))

private fun openCanvas(navController: NavController, container: AppContainer, canvasId: String) =
    openEmbed(navController, container, EditorWebViewActivity.canvasPath(canvasId))

private fun logout(navController: NavController, container: AppContainer) {
    // Before repository.logout(), which clears the token the socket authenticated with.
    container.onLogout(navController.context.applicationContext as android.app.Application)
    container.repository.logout()
    navController.navigate(ROUTE_LOGIN) {
        popUpTo(ROUTE_MAIN) { inclusive = true }
    }
}
