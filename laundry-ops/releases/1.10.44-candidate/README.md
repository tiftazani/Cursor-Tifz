# Cuciin 1.10.44 / build 63

Kandidat disusun 8 Oktober 2026. Kode Android `11115a4`; kode Worker `5d4f0d2`.

## Isi

Pendaftaran ulang menangani email yang masih punya akun Firebase setelah baris staff dihapus. Aplikasi memverifikasi sandi akun lama sebelum mengirim pendaftaran ulang. Pesan gagal menyebut sebabnya, bukan hanya menyarankan cek koneksi.

Server mencoba menghapus akun Firebase setelah `staff.delete`. Produksi sudah memakai Worker `0d01b2e1-0279-424a-b04a-7a37e0fed0a5` sejak 8 Oktober 15.30 WIB. Penghapusan Firebase bersifat best effort: jika Firebase gagal, D1 tetap terhapus dan akun login mungkin masih tertinggal.

## Hasil yang diperiksa

- Android debug: 382 tes lulus, 0 gagal/error/skipped. Tes dijalankan ulang setelah `cleanTestDebugUnitTest`.
- Android release: 382 tes lulus, 0 gagal/error/skipped.
- Lint kedua varian: 0 error, 20 warning per varian.
- Worker `npm run check`: 110 tes lulus, typecheck dan validasi skema lulus.
- Build kedua APK dan AAB melalui `android/scripts/build_cuciin.sh semua`: berhasil.
- Endpoint di dex: debug hanya Worker debug; rilis Worker produksi. Penanda `PendaftaranAkun` ada pada kedua APK.
- `verify_release.py`: PASS. Paket `com.cuciin.laundryops`, build 63, versi 1.10.44; tanda tangan v2, non-debuggable, target SDK, izin minimum, ZIP/ELF 16 KB.
- Sertifikat SHA-256: `3a988c5378a373776625d79c2cd0db2851f1a685f39f0ac18e90d026dc2befee`.
- Salinan APK akar `releases/` dan `~/Downloads/cuciin-1.10.44-{debug,release}.apk` cocok dengan kandidat.
- Bukti sesi sebelumnya: penghapusan akun uji lewat server produksi menghapus akun Firebase dan staff D1; akun uji dibersihkan. Salinan bukti di `bukti/uji-hapus-server-produksi.json`.

## Belum terbukti

Kedua APK dipasang dan dijalankan di emulator API 35. Hash APK terpasang cocok dengan kandidat. Versi benar pada layar Masuk; validasi nama/email kosong tampil di kedua varian. APK rilis menampilkan pesan koneksi gagal saat Wi-Fi dan data benar-benar dimatikan. Buffer crash tidak memuat crash paket Cuciin.

Uji pertama salah menganggap mode pesawat mematikan Wi-Fi. Wi-Fi masih aktif, sehingga akun dummy `qa-no-submit@example.com` benar-benar terdaftar di produksi dan layar Menunggu persetujuan tampil. Aplikasi segera dihentikan. Akun dummy sudah dihapus dari Firebase dan staff D1; tombstone staff/delete disimpan untuk menghapusnya dari perangkat lain. Ini insiden uji, bukan alasan menganggap mode pesawat cukup untuk isolasi.

Bukti dump, tangkapan layar, dan `emulator-results.json` ada di `bukti/`. Kedua aplikasi dihentikan dan jaringan emulator dibiarkan mati.

Daftar ulang lewat UI APK debug juga berhasil: akun dummy sudah ada di Firebase sebelum tombol Daftar ditekan, lalu layar Pendaftaran diterima tampil dan staff D1 debug terbentuk. Akun dummy Firebase dan staff debug sudah dibersihkan, tombstone tetap ada. Bukti di `bukti/reregister-results.json` dan `debug-reregister-final.xml`/`.png`.

Sapu menu Owner/Kasir/SPV tidak diulang. Pendaftaran dan login dari HP pelapor belum diuji. `lastLoginAt` Firebase bukan bukti pengguna berhasil membuka layar aplikasi.

Akun muklis saat pembacaan 8 Oktober 22.24 WIB: D1 aktif dan disetujui, Kasir, cabang bunayya. Firebase akun ada dan tidak ditandai disabled, dibuat 15.50 WIB, login Firebase terakhir 16.22 WIB. Tidak ada sandi pengguna yang dicoba atau diubah pada pemeriksaan ulang.

Artefak dan bukti lokal siap untuk commit. Belum di-push; tidak ada deploy baru. Perubahan produksi pada uji emulator terbatas pada akun dummy di atas dan tombstone pembersihannya. Tidak ada akun operasional atau sandi pengguna yang diubah.
