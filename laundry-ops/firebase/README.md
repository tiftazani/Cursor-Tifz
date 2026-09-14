# Firebase Authentication Cuciin

Folder ini menyimpan konfigurasi provider Authentication sebagai kode. Berkas `google-services.json`, token CLI, akun pengguna, dan kata sandi tidak boleh masuk Git.

Provider yang dipakai adalah Email/Password. Firebase mengirim email reset kata sandi, sedangkan Cloudflare Worker hanya menerima ID token Firebase dan tidak menyimpan kata sandi.

Deployment konfigurasi:

```sh
npx firebase-tools deploy --only auth --project cuciin-ops-tiftazani
```

Konfigurasi SDK Android produksi disimpan privat di `/Users/tiftazani/Documents/ChatGPT/Laundry/signing-private/google-services.json`. Konfigurasi produksi dan debug digabung lokal ke `laundry-ops/android/app/google-services.json` sebelum build. Path aplikasi tersebut sudah diabaikan Git.
