# Verifikasi Cuciin 1.5.0

10 September 2026. Emulator Android API 35, mode pesawat.

- `./gradlew assembleDebug`: berhasil. APK: `1.5.0-debug`, versionCode `6`.
- Login lokal Owner; tambah pelanggan dari nota; pelanggan otomatis terpilih.
- Tambah layanan Cuci 3 kg; kurangi ke 2 kg; total langsung menjadi Rp14.000.
- Pilih lunas dan QRIS; simpan tanpa WA; detail berisi 2 kg, Rp14.000 dibayar, metode QRIS.
- Lanjutkan status laundry; setelah perbaikan state UI, status selesai langsung terlihat dan tombol lanjut hilang. Nota masuk filter Selesai.
- Data pelanggan dan nota tetap tersedia sesudah APK dipasang ulang dengan `install -r`.
- Login SPV: navigasi Antrian/Stok/Modul. Detail tidak menampilkan kirim WA, ekspor nota, atau pelunasan; modul tidak menampilkan pengelolaan pelanggan.
- Pemeriksaan visual: login dan nota pada 320dp; antrian pada 400dp dan tablet 800dp; modul SPV pada landscape 640×360dp. Konten bisa digulir; bottom bar/rail mengikuti ukuran layar.
- `git diff --check`: bersih. CuciinStore.kt, Models.kt, dan CloudSync.kt tidak berubah.
- Dua salinan APK memiliki SHA-256 yang sama: `6b82cbcdd0b6f182eacb22315134bc31331d00bae4db99766f58774db7289cb6`.

Batas verifikasi: tidak menjalankan sinkronisasi server, pengiriman WA, ekspor berkas, atau pemilihan foto. CRUD selain tambah pelanggan tidak diuji satu per satu; fungsi dan pemanggilan CRUD dipertahankan. Screenshot memakai data uji lokal.
