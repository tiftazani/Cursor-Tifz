package com.tiftazani.laundryops

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.tiftazani.laundryops.ui.CuciinRoot
import com.tiftazani.laundryops.ui.theme.CuciinTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent { CuciinTheme { CuciinRoot() } }
    }
}
