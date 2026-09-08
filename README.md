# Triase WA — Aplikasi Android (dibangun otomatis lewat GitHub)

Ini versi APK asli. Kamu **tidak perlu install Node.js, npm, Android Studio, atau apapun**
di HP/laptop kamu. GitHub yang akan membangunkan file APK-nya lewat GitHub Actions —
kamu tinggal upload folder ini, tunggu beberapa menit, lalu download APK jadi.

Cara kerjanya: aplikasi ini membungkus server Node.js (Express + koneksi WhatsApp)
langsung di dalam APK memakai `nodejs-mobile-cordova`, jadi WhatsApp-nya konek
langsung dari dalam aplikasi itu sendiri — tidak butuh Termux atau komputer lain
sama sekali setelah APK-nya terinstall.

---

## 1. Upload folder ini ke GitHub

1. Buat repository baru di [github.com/new](https://github.com/new) (boleh **Private**).
2. Upload **semua isi folder `triase-wa-android`** ini ke repo tersebut — paling gampang
   lewat tombol **"Add file" → "Upload files"** di halaman repo GitHub (drag & drop
   dari HP/laptop, tidak perlu command apapun), lalu klik **Commit changes**.
   > Pastikan struktur foldernya tetap sama (ada folder `.github`, `www`, `nodejs-assets`, dan file `config.xml`).

## 2. Tunggu APK-nya dibangun otomatis

1. Buka tab **Actions** di repo GitHub kamu.
2. Akan ada proses **"Build APK"** yang otomatis berjalan setelah upload tadi (kalau tidak jalan otomatis, klik workflow "Build APK" → **Run workflow**).
3. Tunggu sampai selesai (biasanya 5–10 menit). Tandanya selesai: muncul centang hijau ✅.

## 3. Download APK-nya

1. Klik proses yang sudah selesai tadi (yang ada centang hijau).
2. Scroll ke bawah ke bagian **Artifacts**, klik **triase-wa-apk** untuk download (jadi file `.zip`).
3. Extract file zip itu di HP kamu — isinya file `.apk`.

## 4. Install di HP

1. Buka file `.apk` hasil extract tadi lewat File Manager di HP.
2. Kalau muncul peringatan "Install dari sumber tidak dikenal", izinkan (ini normal untuk APK
   yang bukan dari Play Store).
3. Install seperti aplikasi biasa. Ikon **"Triase WA"** akan muncul di layar utama.

## 5. Pakai Aplikasinya

1. Buka aplikasi **Triase WA**. Layar pertama akan menyalakan server di dalam aplikasi
   (ada log kecil yang jalan, biar kamu tahu prosesnya tidak macet) — tunggu beberapa detik.
2. Setelah siap, otomatis pindah ke layar **Sambungkan WhatsApp**: masukkan nomor WhatsApp,
   kode pairing akan muncul di layar.
3. Di HP dengan nomor itu, buka WhatsApp → **Setelan → Perangkat Tertaut → Tautkan dengan
   nomor telepon** → masukkan kode dari aplikasi.
4. Setelah tersambung, dashboard chat yang sudah tersortir otomatis muncul — sama seperti
   versi sebelumnya, tapi sekarang semuanya jalan di dalam satu aplikasi Android.

Semua fitur sebelumnya tetap ada: deteksi urgensi otomatis, notifikasi WA ke owner,
tandai/lepas urgent manual, filter, dan pengaturan (⚙︎).

---

## Catatan jujur

- **Build pertama kali bisa saja butuh sedikit perbaikan.** Proses build Android (Cordova +
  plugin nodejs-mobile) punya banyak bagian yang saling bergantung, dan saya tidak punya
  cara untuk benar-benar menjalankan build Android di sini untuk mengetesnya lebih dulu.
  Kalau tab Actions menunjukkan tanda silang merah ❌, buka log-nya (klik langkah yang gagal) —
  kalau kamu tempel pesan errornya ke saya, saya bantu perbaiki filenya.
- **Aplikasi tetap butuh koneksi internet aktif** di HP (untuk konek ke server WhatsApp),
  tapi tidak butuh Termux, laptop, atau proses lain yang harus tetap menyala — semuanya
  jalan sendiri di dalam APK.
- **Update aplikasi**: kalau kamu ubah kode lalu upload ulang ke GitHub, tab Actions akan
  otomatis build ulang APK versi terbaru.
- Kata kunci deteksi urgensi ada di `nodejs-assets/nodejs-project/urgency.js` — bisa
  diedit langsung di GitHub (klik file → ikon pensil) tanpa perlu komputer.
