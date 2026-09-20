package com.cuciin.laundryops.ui

import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.ui.Alignment
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Chat
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
import androidx.compose.runtime.LaunchedEffect
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
import com.cuciin.laundryops.data.CuciinStore
import com.cuciin.laundryops.data.Role
import com.cuciin.laundryops.ui.theme.Card
import com.cuciin.laundryops.ui.theme.Gold
import com.cuciin.laundryops.ui.theme.LocalCuciinPalette
import com.cuciin.laundryops.ui.theme.OnHero
import com.cuciin.laundryops.ui.theme.OnPrim
import com.cuciin.laundryops.ui.theme.Foam
import com.cuciin.laundryops.ui.theme.Ink
import com.cuciin.laundryops.ui.theme.Muted
import com.cuciin.laundryops.ui.theme.Teal
import kotlinx.coroutines.launch

private val store get() = CuciinStore

/** Ikon tab: dipetakan dari katalog [NavTabs] karena ikon butuh Compose. */
private fun tabIcon(route: String): ImageVector = when (route) {
    "home" -> Icons.Outlined.Home
    "nota" -> Icons.Outlined.PointOfSale
    "wa" -> Icons.AutoMirrored.Outlined.Chat
    "stok" -> Icons.Outlined.Inventory2
    else -> Icons.Outlined.GridView
}

@Composable
fun CuciinRoot() {
    val nav = rememberNavController()
    val snack = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    val tap = com.cuciin.laundryops.ui.components.rememberTapFeedback()
    val session = store.session.value
    store.revision.intValue
    val ui = rememberUi()
    val route = nav.currentBackStackEntryAsState().value?.destination?.route
    val showBar = session != null && route in NavTabs.routes
    val mapLink = MapSelection.pendingLink.value
    LaunchedEffect(mapLink, session?.email) {
        if (mapLink != null && store.canAccess("branch", "branch.manage") && route != "branches") nav.navigate("branches") { launchSingleTop = true }
    }
    val visibleTabs = if (session == null) emptyList()
    else NavTabs.visibleFor { module, function -> store.canAccess(module, function) }
    fun toast(msg: String) { scope.launch { snack.showSnackbar(msg) } }

    val palette = LocalCuciinPalette.current
    val navSurface = palette.heroA
    val navSelected = palette.navSelected
    val navColors = NavigationBarItemDefaults.colors(
        selectedIconColor = navSelected,
        selectedTextColor = navSelected,
        indicatorColor = OnHero.copy(alpha = 0.14f),
        unselectedIconColor = OnHero.copy(alpha = 0.76f),
        unselectedTextColor = OnHero.copy(alpha = 0.76f),
    )
    val railColors = NavigationRailItemDefaults.colors(
        selectedIconColor = navSelected,
        selectedTextColor = navSelected,
        indicatorColor = OnHero.copy(alpha = 0.14f),
        unselectedIconColor = OnHero.copy(alpha = 0.76f),
        unselectedTextColor = OnHero.copy(alpha = 0.76f),
    )

    /**
     * Berpindah tab.
     *
     * Semua tab berada di satu graf datar dan "home" selalu ada di dasar stack selama pengguna
     * sudah masuk. Karena itu tab tujuan dicapai dengan membersihkan dulu sampai home lalu
     * mendorongnya, semuanya dalam satu panggilan navigate.
     *
     * Sebelumnya di sini dipakai popUpTo(saveState) berpasangan dengan restoreState. Kombinasi
     * itu hanya benar untuk graf bertingkat; pada graf datar ia membuat tab macet: setelah
     * layar Service dibuka dari tombol "Service baru", menekan tab Antrian tidak berpindah
     * sama sekali, sementara tab lain tetap jalan.
     */
    fun go(r: String) {
        tap()
        if (!NavTransition.needsNavigation(route, r)) return
        nav.navigate(r) {
            launchSingleTop = true
            popUpTo(NavTransition.HOME_ROUTE) { inclusive = NavTransition.POP_INCLUSIVE }
        }
    }

    Row(Modifier.fillMaxSize()) {
        if (showBar && ui.useRail) {
            NavigationRail(modifier = Modifier.verticalScroll(rememberScrollState()), containerColor = navSurface, header = { com.cuciin.laundryops.ui.components.BrandMark(Modifier.padding(vertical = 16.dp)) }) {
                visibleTabs.forEach { t ->
                    NavigationRailItem(
                        selected = route == t.route,
                        onClick = { go(t.route) },
                        icon = { Icon(tabIcon(t.route), t.label) },
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
                // Bar muncul dan hilang dengan lembut supaya perpindahan ke layar tanpa bar
                // tidak terasa melompat. Hanya alpha dan geser sedikit, ringan untuk GPU.
                AnimatedVisibility(
                    visible = showBar && ui.compact,
                    enter = slideInVertically(animationSpec = tween(Motion.ms(200), easing = Motion.easing)) { it } +
                        fadeIn(tween(Motion.ms(160))),
                    exit = slideOutVertically(animationSpec = tween(Motion.ms(180), easing = Motion.easing)) { it } +
                        fadeOut(tween(Motion.ms(120))),
                ) {
                    NavigationBar(containerColor = navSurface, contentColor = OnHero) {
                        visibleTabs.forEach { t ->
                            NavigationBarItem(
                                selected = route == t.route,
                                onClick = { go(t.route) },
                                icon = { Icon(tabIcon(t.route), t.label) },
                                label = { Text(t.label, maxLines = 1, overflow = TextOverflow.Ellipsis, fontSize = 11.sp) },
                                colors = navColors,
                            )
                        }
                    }
                }
            },
        ) { pad ->
            // Layar penuh (login dan pembuka) memakai wallpaper sampai tepi layar. Bila
            // padding Scaffold ikut dipasang, area bar sistem tidak tertutup gambar dan latar
            // Scaffold yang terang terlihat sebagai pita di bawah. Layar penuh karena itu
            // melewatkan padding itu dan mengatur insetnya sendiri.
            val fullBleed = route == "login" || route == "onboarding" || route == "register" || route == "pending"
            Box(
                Modifier
                    .then(if (fullBleed) Modifier else Modifier.padding(pad))
                    .fillMaxSize()
                    .imePadding(),
                contentAlignment = Alignment.TopCenter,
            ) {
                NavHost(
                    nav,
                    // Layar pembuka muncul sekali setelah aplikasi dipasang. Setelah itu
                    // langsung ke masuk atau beranda sesuai keadaan sesi.
                    startDestination = when {
                        session != null -> "home"
                        !OnboardingPrefs.alreadySeen -> "onboarding"
                        else -> "login"
                    },
                    modifier = Modifier.widthIn(max = 960.dp).fillMaxSize(),
                    // Perpindahan layar: layar baru menyusul dari kanan sambil memudar, layar lama
                    // mundur sedikit. Hanya alpha dan geser, jadi dikerjakan GPU dan ringan di HP
                    // kelas bawah. Durasi mengikuti pengaturan animasi sistem lewat Motion.
                    enterTransition = {
                        slideInHorizontally(animationSpec = tween(Motion.ms(220), easing = Motion.easing)) { it / 12 } +
                            fadeIn(tween(Motion.ms(180)))
                    },
                    exitTransition = {
                        slideOutHorizontally(animationSpec = tween(Motion.ms(200), easing = Motion.easing)) { -it / 16 } +
                            fadeOut(tween(Motion.ms(140)))
                    },
                    popEnterTransition = {
                        slideInHorizontally(animationSpec = tween(Motion.ms(220), easing = Motion.easing)) { -it / 12 } +
                            fadeIn(tween(Motion.ms(180)))
                    },
                    popExitTransition = {
                        slideOutHorizontally(animationSpec = tween(Motion.ms(200), easing = Motion.easing)) { it / 16 } +
                            fadeOut(tween(Motion.ms(140)))
                    },
                ) {
                    composable("onboarding") {
                        OnboardingScreen(nav) {
                            OnboardingPrefs.markSeen()
                            nav.navigate("login") { popUpTo("onboarding") { inclusive = true } }
                        }
                    }
                    composable("login") { LoginScreen(nav, ::toast) }
                    composable("register") { RegisterScreen(nav, ::toast) }
                    composable("pending") { PendingScreen(nav) }
                    composable("home") { HomeScreen(nav) }
                    composable("nota") { NotaScreen(nav, ::toast) }
                    composable("preview") { PreviewScreen(nav, ::toast) }
                    composable("bayar") { BayarScreen(nav, ::toast) }
                    composable("queue/{id}") { e -> QueueDetailScreen(nav, e.arguments?.getString("id") ?: "", ::toast) }
                    composable("queueEdit/{id}") { e -> QueueEditScreen(nav, e.arguments?.getString("id") ?: "", ::toast) }
                    composable("wa") { WaListScreen(nav, archive = false) }
                    composable("waArchive") { WaListScreen(nav, archive = true) }
                    composable("stok") { StockScreen(nav, ::toast) }
                    composable("stokEdit") { StockEditScreen(nav, ::toast) }
                    composable("stokHistory") { StockHistoryScreen(nav) }
                    composable("more") { MoreScreen(nav) }
                    composable("analytics") { AnalyticsScreen(nav) }
                    composable("analyticsReport") { AnalyticsReportScreen(nav) }
                    composable("branches") { BranchesScreen(nav, ::toast) }
                    composable("audit") { AuditScreen(nav) }
                    composable("users") { UsersScreen(nav, ::toast) }
                    composable("services") { ServicesScreen(nav, ::toast) }
                    composable("products") { ProductsScreen(nav, ::toast) }
                    composable("inventory") { AssetListScreen(nav, ::toast) }
                    composable("assetNew") { AssetFormScreen(nav, null, ::toast) }
                    composable("assetEdit/{id}") { e -> AssetFormScreen(nav, e.arguments?.getString("id"), ::toast) }
                    composable("assetTypes") { AssetTypesScreen(nav, ::toast) }
                    composable("accessRoles") { AccessRolesScreen(nav, ::toast) }
                    composable("accessRole/{id}") { e -> AccessRoleEditScreen(nav, e.arguments?.getString("id") ?: "", ::toast) }
                    composable("accessRoleUser/{email}") { e -> AccessRoleUserScreen(nav, e.arguments?.getString("email") ?: "", ::toast) }
                    composable("ownerSettings") { OwnerSettingsScreen(nav, ::toast) }
                    composable("expenses") { ExpensesScreen(nav, ::toast) }
                    composable("attendance") { AttendanceScreen(nav, ::toast) }
                    composable("versions") { VersionScreen(nav) }
                    composable("theme") { ThemeScreen(nav) }
                    composable("menuOrder") { MenuOrderScreen(nav) }
                    composable("cash") { CashScreen(nav, ::toast) }
                    composable("customers") { CustomersScreen(nav, ::toast) }
                    composable("profil") { ProfilScreen(nav, ::toast) }
                }
            }
        }
    }
}
