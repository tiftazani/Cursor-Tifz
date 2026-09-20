# Pengujian

Cara memastikan perubahan tidak merusak apa pun, di mesin maupun di perangkat.

> Ringkasan: tes di mesin menjaga aturan, sedangkan pemeriksaan di perangkat membuktikan tampilannya benar-benar terbuka. Keduanya diperlukan karena aturan yang benar tetap bisa menghasilkan layar yang tidak bisa dibuka.

## Tujuan

Dua jenis kesalahan sering lolos bila hanya salah satu cara yang dipakai. Kesalahan aturan lolos bila hanya memeriksa tampilan. Kesalahan tampilan lolos bila hanya menjalankan tes, karena tes tidak membuka layar sungguhan.

## Susunan tes di mesin

Tes berada di `android/app/src/test`. Seluruhnya berjalan di JVM tanpa perangkat.

| Kelompok | Yang dijaga |
|---|---|
| Katalog akses | Setiap kunci izin di layar ada di katalog |
| Gerbang rute | Rute menolak peran yang tidak berhak |
| Aturan bisnis | Harga, pembayaran, kas, dan koreksi tidak melanggar aturan |
| Sinkronisasi | Perintah tidak dikerjakan dua kali, penolakan dibaca benar |
| Menu | Susunan menu tetap berisi seluruh rute |

Pada versi `1.10.30` jumlahnya 269 untuk varian debug dan 269 untuk varian rilis.

## Menjalankan tes

```bash
cd android
./gradlew testDebugUnitTest
./gradlew testReleaseUnitTest
```

## Memverifikasi hasil dengan angka

Keluaran Gradle tidak menyebut jumlah tes. Ambil dari berkas hasil:

```bash
python3 - <<'PY'
import glob, xml.etree.ElementTree as ET
for varian in ("testDebugUnitTest", "testReleaseUnitTest"):
    t = f = e = 0
    for p in glob.glob(f"app/build/test-results/{varian}/*.xml"):
        r = ET.parse(p).getroot()
        t += int(r.get("tests", 0)); f += int(r.get("failures", 0)); e += int(r.get("errors", 0))
    print(f"{varian}: {t} tes, {f} gagal, {e} error")
PY
```

## Menguji tampilan di perangkat

Tes di mesin tidak membuka layar. Untuk membuktikan seluruh menu benar-benar terbuka, ada skrip sapu di `android/scripts/sapu_role.py`.

```bash
python3 android/scripts/sapu_role.py "email@contoh.test" "kata-sandi" "Owner" "Owner"
```

Skrip itu membuka setiap menu satu per satu, lalu menilai **bukti** bahwa layar tujuan benar-benar muncul. Hasilnya dilaporkan sebagai `OK` atau `CEK`, beserta ringkasan crash.

### Mengapa penilaiannya harus berbasis bukti

Dua cara menilai yang tampak benar tetapi menyesatkan, dan keduanya pernah terjadi:

| Cara menilai yang salah | Akibatnya |
|---|---|
| Menganggap berhasil hanya karena label menu ditemukan dan ditekan | Menu yang menendang pengguna kembali ke daftar tetap dilaporkan berhasil |
| Mencocokkan judul layar dengan nama menu | Label menu masih terbaca di daftar, sehingga menu yang tidak membuka apa pun dilaporkan berhasil |

Penilaian yang benar menuntut dua hal sekaligus: daftar menu **sudah tidak terlihat lagi**, dan judul layar tujuan benar-benar muncul.

> **PERHATIAN**
> Sebelum menjalankan sapu, pastikan tidak ada proses sapu lain yang masih berjalan. Dua proses pada emulator yang sama saling menekan tombol keluar dan mengganggu, sehingga laporan berisi kegagalan yang tidak nyata.

```bash
pgrep -fl sapu_role.py
```

## Membuktikan bahwa pengujian benar-benar menangkap kesalahan

Pengujian yang selalu melaporkan berhasil tidak berguna. Setiap kali aturan baru ditambahkan, uji dengan sengaja merusaknya lebih dulu:

1. ubah satu pemeriksaan agar selalu menolak;
2. jalankan pengujian;
3. pastikan ia **gagal** dan menyebut tempat yang benar;
4. kembalikan perubahan.

Langkah ini pernah dilakukan pada rute `ownerSettings`: gerbangnya sengaja dikembalikan ke kunci lama, dan sapu melaporkan menu itu `TIDAK TERBUKA` sementara 20 menu lain tetap `OK`. Bukti itu yang membuat hasil sapu layak dipercaya.

## Bila hasilnya berbeda

| Gejala | Penyebab yang diketahui | Tindakan |
|---|---|---|
| Semua menu dilaporkan gagal di tengah pemeriksaan | Ada proses sapu lain berjalan, atau aplikasi kehilangan fokus | Hentikan proses lain, ulangi dari awal |
| Menu dilaporkan gagal padahal terlihat terbuka | Nomor layar dibaca terlalu cepat sebelum selesai digambar | Beri jeda lebih panjang; jangan longgarkan penilaian |
| Hasil sapu berbeda dari pemeriksaan sebelumnya | Versi terpasang berbeda dari yang baru dibangun | Periksa versi terpasang, pasang ulang bila perlu |

## Risiko dan batasan

- **Belum ada tes otomatis di perangkat.** Berkas `androidTest` masih kosong, sehingga pendaftaran akun dan pengoperasian layar sungguhan belum tercakup.
- **Skrip sapu adalah alat, bukan kebenaran.** Perbaiki alatnya bila ia melaporkan kegagalan yang tidak nyata; jangan melemahkan penilaiannya agar laporan terlihat bagus.
