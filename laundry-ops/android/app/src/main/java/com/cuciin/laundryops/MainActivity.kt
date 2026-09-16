package com.cuciin.laundryops

import android.os.Bundle
import android.content.Intent
import android.graphics.Color
import com.cuciin.laundryops.ui.MapSelection
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.SystemBarStyle
import androidx.activity.enableEdgeToEdge
import com.cuciin.laundryops.ui.CuciinRoot
import com.cuciin.laundryops.ui.theme.CuciinTheme
import com.cuciin.laundryops.ui.theme.ThemePrefs

class MainActivity : ComponentActivity() {
    override fun attachBaseContext(newBase: android.content.Context) {
        val locale = java.util.Locale.forLanguageTag("id-ID")
        java.util.Locale.setDefault(locale)
        val configuration = android.content.res.Configuration(newBase.resources.configuration).apply { setLocale(locale) }
        super.attachBaseContext(newBase.createConfigurationContext(configuration))
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        ThemePrefs.attach(this)
        captureSharedMap(intent)
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.auto(Color.TRANSPARENT, Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.auto(Color.TRANSPARENT, Color.TRANSPARENT),
        )
        setContent { CuciinTheme { CuciinRoot() } }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        captureSharedMap(intent)
    }

    /** Consume once: survives return from Maps, but is not replayed on rotation. */
    private fun captureSharedMap(sharedIntent: Intent) {
        MapSelection.receive(sharedIntent)
        if (sharedIntent.action == Intent.ACTION_SEND) {
            sharedIntent.action = null
            sharedIntent.removeExtra(Intent.EXTRA_TEXT)
            sharedIntent.clipData = null
        }
    }
}
