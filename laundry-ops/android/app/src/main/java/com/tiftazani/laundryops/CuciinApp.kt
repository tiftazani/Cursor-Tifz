package com.tiftazani.laundryops

import android.app.Application
import com.tiftazani.laundryops.data.CuciinStore
import com.tiftazani.laundryops.data.FirebaseCloud

class CuciinApp : Application() {
    override fun onCreate() {
        super.onCreate()
        CuciinStore.attach(this)
        FirebaseCloud.init(this)
    }
}
