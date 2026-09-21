# Mulai Cepat

Menyiapkan lingkungan dan menjalankan Cuciin di perangkat atau emulator.

**Hasil akhir:** aplikasi `com.cuciin.laundryops.debug` berjalan di emulator, dan tes unit lulus.

## Kebutuhan lingkungan

| Kebutuhan | Nilai yang dipakai proyek |
|---|---|
| JDK | OpenJDK 17 |
| Android SDK | `compileSdk` 36 |
| Variabel lingkungan | `JAVA_HOME`, `ANDROID_HOME` |
| Emulator acuan | `MindChampions_API35`, layar 1080 x 2400 |

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@17
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
```

> **PERHATIAN**
> `minSdk` proyek adalah 26. Perangkat atau emulator di bawah Android 8.0 tidak dapat memasang aplikasi ini.

## Membangun aplikasi

```bash
cd android
./gradlew assembleDebug
```

Hasilnya di `android/app/build/outputs/apk/debug/app-debug.apk`.

Untuk memastikan aplikasi benar-benar bisa dirilis, bangun juga varian rilis:

```bash
./gradlew assembleRelease
```

Varian rilis memerlukan berkas properti penandatanganan. Bila belum ada, proses akan berhenti dengan pesan `Rilis memerlukan CUCIIN_SIGNING_PROPERTIES`. Arahkan variabel itu ke berkas properti yang benar sebelum membangun rilis:

```bash
export CUCIIN_SIGNING_PROPERTIES=/jalur/ke/cuciin-signing.properties
```

> **BAHAYA**
> Jangan menyimpan kata sandi keystore, token, atau berkas penandatanganan di dalam repositori. Simpan di luar proyek dan hanya lewat variabel lingkungan.

## Memasang dan menjalankan

```bash
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n com.cuciin.laundryops.debug/com.cuciin.laundryops.MainActivity
```

## Memverifikasi bahwa pemasangan benar

Memeriksa versi yang benar-benar terpasang, bukan versi berkas APK:

```bash
adb shell dumpsys package com.cuciin.laundryops.debug | grep -E "versionName|versionCode"
```

Hasil yang benar menyebut `versionCode=49` dan `versionName=1.10.30-debug`.

> **PERHATIAN**
> Emulator dapat menyimpan APK lama. Bila nomor versi yang terpasang lebih rendah dari berkas yang baru dibangun, pasang ulang dengan `adb install -r`. Versi yang lebih rendah membuat gejala yang menyesatkan, misalnya menu yang seharusnya sudah diperbaiki tetap tampak rusak.

## Menjalankan tes

```bash
./gradlew testDebugUnitTest
```

Hasil ringkas dari berkas XML:

```bash
python3 - <<'PY'
import glob, xml.etree.ElementTree as ET
t = f = 0
for p in glob.glob("app/build/test-results/testDebugUnitTest/*.xml"):
    r = ET.parse(p).getroot()
    t += int(r.get("tests", 0)); f += int(r.get("failures", 0))
print(f"{t} tes, {f} gagal")
PY
```

## Bila hasilnya berbeda

| Gejala | Penyebab yang diketahui | Tindakan |
|---|---|---|
| `Rilis memerlukan CUCIIN_SIGNING_PROPERTIES` | Variabel lingkungan penandatanganan belum diisi | Arahkan ke berkas properti penandatanganan yang benar |
| Versi terpasang lebih rendah dari yang baru dibangun | APK lama masih terpasang | `adb install -r` berkas APK yang baru |
| Aplikasi tertutup sendiri beberapa detik setelah dibuka | Emulator kehabisan memori, bukan cacat aplikasi | Matikan emulator, nyalakan ulang, dan kurangi proses latar |
| Menu terbuka tetapi layarnya kosong di emulator | Proses pembacaan layar otomatis masih berjalan di latar dan menekan aplikasi | Hentikan proses latar itu dulu, baru ulangi pemeriksaan |
