# SuikaUploader — Media Hub

## Struktur folder

```
SuikaUploader/
├── index.html          # markup halaman (Beranda, Upload, Tools, Gallery/Log, Info)
├── css/
│   └── style.css        # semua styling & animasi
├── js/
│   ├── config.js         # GITHUB_CONFIG, IG_CONFIG — EDIT DI SINI sebelum deploy
│   ├── api.js             # semua fetch/API: upload GitHub, TikTok DL, IG DL
│   └── ui.js               # navigasi, render UI, dashboard/gallery/settings, utils
└── tools/
    ├── apk-builder/       # tool tambahan: HTML/gambar → APK Android
    │   ├── index.html      # markup APK Builder (halaman terpisah, buka di tab baru)
    │   ├── css/
    │   │   └── style.css    # styling khusus APK Builder
    │   └── js/
    │       ├── storage.js   # helper localStorage + deteksi dark mode
    │       ├── github.js    # fetch ke GitHub REST API (create repo, upload file, workflow runs, artifacts)
    │       ├── ui.js         # tab nav, snackbar, modal, upload icon/HTML, preview, settings
    │       └── build.js      # generate config.xml & package.json Cordova + proses build & polling artifact
    └── getcode/           # tool tambahan: ambil source code website jadi ZIP
        ├── index.html      # markup GetCode (halaman terpisah, buka di tab baru, pakai css/style.css utama)
        ├── css/
        │   └── style.css    # styling tambahan khusus GetCode (log list, badge metode)
        └── js/
            └── getcode.js   # fetch HTML+resource via proxy (dgn fallback proxy kedua), build ZIP pakai JSZip
```

### Tentang tool "APK Builder"

Tool ini kamu upload sendiri sebagai file HTML satu-file. Saat diintegrasikan, dua bagian sengaja **dibuang**:

- Sebuah `<script src="https://compassionpersonify.com/...">` — domain pihak ketiga yang tidak jelas asalnya, pola khas skrip iklan/tracking yang disisipkan tanpa izin. Tidak ikut dipasang.
- Kode yang memblokir klik kanan, memblokir F12/DevTools, dan mem-blank halaman kalau DevTools kebuka — ini justru menghalangi kamu sendiri untuk mengembangkan/debug tool-nya. Dibuang juga.

Cara kerja tool ini murni client-side ke GitHub API kamu sendiri: kamu isi HTML app + ikon di tab **Editor**, tool bikin/isi repo GitHub dengan project Cordova, lalu trigger **GitHub Actions** untuk build APK debug, dan kamu download artifact APK-nya dari tab **Build**. Butuh GitHub Personal Access Token (scope `repo` + `workflow`) yang kamu masukkan sendiri di form Settings — token ini disimpan di localStorage browser kamu, bukan dikirim ke server manapun selain GitHub.

Akses dari halaman utama: klik card **APK Builder** di Tools Hub (akan terbuka di tab baru).

### Tentang tool "GetCode"

Tool ini mengambil source code sebuah website (HTML halaman utama + semua resource yang terhubung: JS, CSS, gambar, font, media) lalu mengemasnya jadi satu file ZIP yang bisa langsung diunduh — semua diproses di browser (pakai [JSZip](https://stuk.github.io/jszip/), tidak ada upload ke server manapun).

Karena murni client-side, request ke domain lain butuh CORS proxy publik: proxy utama (`cors.yardansh.com`, sama seperti yang dipakai fitur IG Downloader), dan kalau gagal otomatis dicoba ulang lewat proxy cadangan (`api.allorigins.win`) yang infrastrukturnya beda — sering berhasil di situs yang menolak proxy pertama. **Catatan:** browser tidak mengizinkan JavaScript meng-override header `User-Agent` secara manual (ini dibatasi browser sendiri demi keamanan), jadi "metode kedua" di sini berupa pergantian proxy, bukan literal spoofing UA.

File CSS yang berhasil diunduh ikut di-scan ulang untuk mencari `url(...)` tambahan di dalamnya (font, background image) supaya cakupannya makin lengkap, bukan cuma resource yang tertulis langsung di tag HTML.

Akses dari halaman utama: klik card **GetCode** di beranda atau Tools Hub (akan terbuka di tab baru).

## Setup sebelum deploy

Buka `js/config.js`, isi:

```js
const GITHUB_CONFIG = {
  owner:  'USERNAME_GITHUB_KAMU',
  repo:   'NAMA_REPO',
  branch: 'main',
  folder: 'nama-folder-tujuan',
  token:  'ghp_xxxxxxxxxxxxxxxxxxxx',  // Personal Access Token (repo scope)
};
```

⚠️ **Penting:** token GitHub ini akan terlihat oleh siapa saja yang buka halaman (view-source), karena semuanya jalan di browser (client-side). Kalau situs ini bakal di-deploy publik, sebaiknya:
- Buat token dengan scope terbatas (cuma `repo` di repo tujuan), atau
- Pindahkan proses upload ke serverless function (mis. Vercel API route) supaya token tidak ikut ke-bundle di frontend.

## Menjalankan

Karena sekarang file dipecah (CSS/JS eksternal), buka `index.html` lewat local server (bukan `file://`) supaya path relatif jalan normal, contoh:

```bash
npx serve .
# atau
python3 -m http.server 8000
```

Lalu buka `http://localhost:8000` (atau port yang muncul).

Untuk deploy ke GitHub Pages / Vercel, tinggal push seluruh folder ini — nggak perlu setup tambahan.
