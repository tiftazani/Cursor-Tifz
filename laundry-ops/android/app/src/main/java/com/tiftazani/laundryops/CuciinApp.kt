package com.tiftazani.laundryops

import android.app.Application
import com.tiftazani.laundryops.data.FirebaseCloud

class CuciinApp : Application() {
    override fun onCreate() {
        super.onCreate()
        FirebaseCloud.init(this)
    }
}
