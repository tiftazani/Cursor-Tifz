import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
    id("com.google.gms.google-services") apply false
}

// The file lives outside the repository. Never commit signing credentials.
val signingPropertiesPath = providers.environmentVariable("CUCIIN_SIGNING_PROPERTIES").orNull
val releaseSigning = Properties().apply {
    signingPropertiesPath?.let { path -> file(path).inputStream().use { load(it) } }
}
val signingKeys = listOf("storeFile", "storePassword", "keyAlias", "keyPassword")
val hasReleaseSigning = signingKeys.all { !releaseSigning.getProperty(it).isNullOrBlank() }
fun buildConfigString(value: String): String = "\"${value.replace("\\", "\\\\").replace("\"", "\\\"")}\""
// Konfigurasi cloud dibaca berurutan: environment variable menang, lalu file privat
// di luar repo. File ini juga dipakai build lokal tanpa perlu mengekspor env var dulu,
// supaya debug dan release sama-sama tersambung ke server yang benar.
val cloudProperties = Properties().apply {
    val path = providers.environmentVariable("CUCIIN_CLOUD_PROPERTIES").orNull
        ?: listOf(
            rootProject.file("../signing-private/cuciin-cloud.properties"),
            file("../../../../signing-private/cuciin-cloud.properties"),
        ).firstOrNull { it.isFile }?.absolutePath
    path?.let { candidate -> file(candidate).takeIf { it.isFile }?.inputStream()?.use { load(it) } }
}
// Konfigurasi release memakai Worker produksi. Debug selalu memakai Worker dan D1 test
// agar data uji tidak dapat masuk ke database operasional.
val releaseCloudUrl = providers.environmentVariable("CUCIIN_CLOUD_URL").orNull
    ?: cloudProperties.getProperty("cloudUrl").orEmpty()
val debugCloudUrl = providers.environmentVariable("CUCIIN_DEBUG_CLOUD_URL").orNull
    ?: cloudProperties.getProperty("debugCloudUrl")
    ?: "https://cuciin-api-debug.tiftazani-cuciin.workers.dev/api/cuciin"
val cloudKey = providers.environmentVariable("CUCIIN_CLOUD_KEY").orNull
    ?: cloudProperties.getProperty("cloudKey").orEmpty()

// Kedua varian wajib memiliki endpoint sendiri. Debug tidak pernah fallback ke produksi.
tasks.configureEach {
    if (name == "preDebugBuild" || name == "preReleaseBuild") {
        doFirst {
            val endpoint = if (name == "preDebugBuild") debugCloudUrl else releaseCloudUrl
            check(endpoint.isNotBlank()) {
                "Endpoint cloud untuk varian $name kosong."
            }
        }
    }
}
val verifyReleaseSigning by tasks.registering {
    doLast {
        check(hasReleaseSigning) {
            "Rilis memerlukan CUCIIN_SIGNING_PROPERTIES dengan storeFile, storePassword, keyAlias, keyPassword."
        }
        check(file(releaseSigning.getProperty("storeFile")).isFile) { "Keystore rilis tidak ditemukan." }
    }
}
tasks.configureEach {
    if (name == "preReleaseBuild") dependsOn(verifyReleaseSigning)
}

android {
    namespace = "com.cuciin.laundryops"
    compileSdk = 36
    defaultConfig {
        applicationId = "com.cuciin.laundryops"
        minSdk = 26
        targetSdk = 36
        versionCode = 58
        versionName = "1.10.39"
        buildConfigField("String", "CUCIIN_CLOUD_URL", buildConfigString(releaseCloudUrl))
        buildConfigField("String", "CUCIIN_CLOUD_KEY", buildConfigString(cloudKey))
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }
    bundle {
        language { enableSplit = false }
    }
    signingConfigs {
        if (hasReleaseSigning) {
            create("production") {
                storeFile = file(releaseSigning.getProperty("storeFile"))
                storePassword = releaseSigning.getProperty("storePassword")
                keyAlias = releaseSigning.getProperty("keyAlias")
                keyPassword = releaseSigning.getProperty("keyPassword")
                enableV1Signing = false
                enableV2Signing = true
                enableV3Signing = true
            }
        }
    }
    buildTypes {
        release {
            isDebuggable = false
            if (hasReleaseSigning) signingConfig = signingConfigs.getByName("production")
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
        debug {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
            buildConfigField("String", "CUCIIN_CLOUD_URL", buildConfigString(debugCloudUrl))
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures {
        compose = true
        buildConfig = true
    }
    packaging { resources { excludes += "/META-INF/{AL2.0,LGPL2.1}" } }
}

dependencies {
    testImplementation("junit:junit:4.13.2")
    val composeBom = platform("androidx.compose:compose-bom:2024.12.01")
    implementation(composeBom)
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("androidx.navigation:navigation-compose:2.8.5")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")
    debugImplementation("androidx.compose.ui:ui-tooling")

    val firebaseBom = platform("com.google.firebase:firebase-bom:33.7.0")
    implementation(firebaseBom)
    implementation("com.google.firebase:firebase-auth")
}

// Tanpa google-services.json app tetap compile + jalan lokal.
if (file("google-services.json").exists()) {
    apply(plugin = "com.google.gms.google-services")
}
