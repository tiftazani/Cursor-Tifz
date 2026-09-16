package com.cuciin.laundryops

import android.app.Application
import com.cuciin.laundryops.data.CuciinStore
import com.cuciin.laundryops.data.FirebaseCloud

class CuciinApp : Application() {
    override fun onCreate() {
        super.onCreate()
        FirebaseCloud.init(this)
        CuciinStore.attach(this)
    }
}
