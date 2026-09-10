package com.tiftazani.laundryops.ui

import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Chat
import androidx.compose.material.icons.outlined.GridView
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Inventory2
import androidx.compose.material.icons.outlined.PointOfSale
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.NavigationRail
import androidx.compose.material3.NavigationRailItem
import androidx.compose.material3.NavigationRailItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.sp
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.tiftazani.laundryops.data.CuciinStore
import com.tiftazani.laundryops.data.Role
import com.tiftazani.laundryops.ui.theme.Card
import com.tiftazani.laundryops.ui.theme.Foam
import com.tiftazani.laundryops.ui.theme.Ink
import com.tiftazani.laundryops.ui.theme.Muted
import com.tiftazani.laundryops.ui.theme.Teal
import kotlinx.coroutines.launch

private val store get() = CuciinStore

private data class Tab(val route: String, val label: String, val icon: ImageVector, val show: (Role) -> Boolean)

private val tabs = listOf(
    Tab("home", "Antrian", Icons.Outlined.Home) { true },
    Tab("nota", "Nota", Icons.Outlined.PointOfSale) { it != Role.Supervisor },
    Tab("wa", "WA", Icons.Outlined.Chat) { it != Role.Supervisor },
    Tab("stok", "Stok", Icons.Outlined.Inventory2) { true },
    Tab("more", "Modul", Icons.Outlined.GridView) { true },
)

@Composable
fun CuciinRoot() {
    val nav = rememberNavController()
    val snack = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    val session = store.session.value
    store.revision.intValue
    val ui = rememberUi()
    val route = nav.currentBackStackEntryAsState().value?.destination?.route
    val showBar = session != null && route in setOf("home", "nota", "wa", "stok", "more")
    val visibleTabs = tabs.filter { session != null && it.show(session.role) }
    fun toast(msg: String) { scope.launch { snack.showSnackbar(msg) } }

    val navColors = NavigationBarItemDefaults.colors(
        selectedIconColor = Teal,
        selectedTextColor = Teal,
        indicatorColor = Teal.copy(alpha = 0.14f),
        unselectedIconColor = Muted,
        unselectedTextColor = Muted,
    )
    val railColors = NavigationRailItemDefaults.colors(
        selectedIconColor = Teal,
        selectedTextColor = Teal,
        indicatorColor = Teal.copy(alpha = 0.14f),
        unselectedIconColor = Muted,
        unselectedTextColor = Muted,
    )

    fun go(r: String) {
        nav.navigate(r) { launchSingleTop = true }
    }

    Row(Modifier.fillMaxSize()) {
        if (showBar && ui.useRail) {
            NavigationRail(containerColor = Card) {
                visibleTabs.forEach { t ->
                    NavigationRailItem(
                        selected = route == t.route,
                        onClick = { go(t.route) },
                        icon = { Icon(t.icon, t.label) },
                        label = { Text(t.label, maxLines = 1, overflow = TextOverflow.Ellipsis, fontSize = 11.sp) },
                        colors = railColors,
                    )
                }
            }
        }
        Scaffold(
            containerColor = Foam,
            snackbarHost = { SnackbarHost(snack) },
            bottomBar = {
                if (showBar && ui.compact) {
                    NavigationBar(containerColor = Card, contentColor = Ink) {
                        visibleTabs.forEach { t ->
                            NavigationBarItem(
                                selected = route == t.route,
                                onClick = { go(t.route) },
                                icon = { Icon(t.icon, t.label) },
                                label = { Text(t.label, maxLines = 1, overflow = TextOverflow.Ellipsis, fontSize = 11.sp) },
                                colors = navColors,
                            )
                        }
                    }
                }
            },
        ) { pad ->
            NavHost(
                nav,
                startDestination = if (session == null) "login" else "home",
                modifier = Modifier.padding(pad).fillMaxSize(),
            ) {
                composable("login") { LoginScreen(nav, ::toast) }
                composable("register") { RegisterScreen(nav, ::toast) }
                composable("pending") { PendingScreen(nav) }
                composable("home") { HomeScreen(nav) }
                composable("nota") { NotaScreen(nav, ::toast) }
                composable("bayar") { BayarScreen(nav, ::toast) }
                composable("queue/{id}") { e -> QueueDetailScreen(nav, e.arguments?.getString("id") ?: "", ::toast) }
                composable("wa") { WaListScreen(nav, archive = false) }
                composable("waArchive") { WaListScreen(nav, archive = true) }
                composable("stok") { StockScreen(nav, ::toast) }
                composable("stokEdit") { StockEditScreen(nav, ::toast) }
                composable("stokHistory") { StockHistoryScreen(nav) }
                composable("more") { MoreScreen(nav) }
                composable("analytics") { AnalyticsScreen(nav) }
                composable("branches") { BranchesScreen(nav, ::toast) }
                composable("audit") { AuditScreen(nav) }
                composable("users") { UsersScreen(nav, ::toast) }
                composable("services") { ServicesScreen(nav, ::toast) }
                composable("products") { ProductsScreen(nav, ::toast) }
                composable("versions") { VersionScreen(nav) }
                composable("cash") { CashScreen(nav, ::toast) }
                composable("customers") { CustomersScreen(nav, ::toast) }
                composable("profil") { ProfilScreen(nav, ::toast) }
            }
        }
    }
}
