# Firebase Authentication Cuciin

Folder ini menyimpan konfigurasi provider Authentication sebagai kode. Berkas `google-services.json`, token CLI, akun pengguna, dan kata sandi tidak boleh masuk Git.

Provider yang dipakai adalah Email/Password. Firebase mengirim email reset kata sandi, sedangkan Cloudflare Worker hanya menerima ID token Firebase dan tidak menyimpan kata sandi.

Deployment konfigurasi:

```sh
npx firebase-tools deploy --only auth --project cuciin-ops-tiftazani
```

Konfigurasi SDK Android produksi disimpan privat di `/Users/tiftazani/Documents/ChatGPT/Laundry/signing-private/google-services.json`. Konfigurasi produksi dan debug digabung lokal ke `laundry-ops/android/app/google-services.json` sebelum build. Path aplikasi tersebut sudah diabaikan Git.

## Konfigurasi email reset kata sandi

Email reset dikirim Firebase, bukan oleh aplikasi. Dua hal diatur lewat Identity Toolkit API karena isi template sedang dibatasi Firebase (`EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED`):

```sh
# Bahasa email dan halaman reset (locale project)
PATCH https://identitytoolkit.googleapis.com/v2/projects/cuciin-ops-tiftazani/config?updateMask=notification.defaultLocale
{ "notification": { "defaultLocale": "id" } }

# Host tautan di email: dipindah dari firebaseapp.com ke web.app
PATCH https://identitytoolkit.googleapis.com/v2/projects/cuciin-ops-tiftazani/config?updateMask=notification.sendEmail.callbackUri
{ "notification": { "sendEmail": { "callbackUri": "https://cuciin-ops-tiftazani.web.app/__/auth/action" } } }
```

Panggil dengan `Authorization: Bearer <access token firebase-tools>`. Nilai saat ini:

- `defaultLocale`: `id`
- `callbackUri`: `https://cuciin-ops-tiftazani.web.app/__/auth/action`

Tautan reset wajib membawa empat parameter: `mode`, `oobCode`, `apiKey`, dan `lang`. Kalau salah satu hilang di jalan (mis. dipotong mail client atau pemindai tautan), halaman menampilkan "The selected page mode is invalid." sebelum sempat memproses kode.

### Isi template masih bawaan Firebase

Per 15 September 2026, mengubah isi template email (`subject`, `body`) ditolak API dengan `EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED`, dan hal yang sama terjadi dari Firebase Console. Subjek dan isi email saat ini masih template bawaan Firebase yang otomatis memakai locale project, jadi teksnya berbahasa Indonesia tetapi gaya bahasanya belum dapat disesuaikan. Perubahan isi perlu diminta ke dukungan Firebase, atau menunggu kebijakan itu dibuka kembali.

### Yang belum dikerjakan

Custom domain untuk tautan reset (`app.cuciin.id` atau sejenisnya) ditunda oleh Owner. Bila nanti dikerjakan: beli domain, verifikasi di Firebase Hosting, tambahkan ke `authorizedDomains`, lalu ubah `callbackUri` ke domain tersebut.
