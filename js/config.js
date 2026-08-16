// ============================================================
//  ⚙️ CONFIG — GitHub repo target, Instagram downloader keys
//  EDIT DI SINI SEBELUM DEPLOY
// ============================================================
const GITHUB_CONFIG = {
  owner:  'SuikaRYP',   // github username lo
  repo:   'SuikaUploader',       // nama repo
  branch: 'main',            // branch target
  folder: 'Suika',         // folder di dalam repo
  token:  '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',      // ghp_xxxxxxxxxxxxxxxxxxxx
};
// ============================================================

// ============================================================
//  ▲ VERCEL CONFIG — dipakai buat fitur Deploy Website
//  EDIT DI SINI SEBELUM DEPLOY (token dari vercel.com/account/tokens)
// ============================================================
const VERCEL_CONFIG = {
  token:  'YOUR_VERCEL_TOKEN', // vcp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
  teamId: null,                // isi teamId kalau project di bawah Vercel Team, personal account biarin null
};
// ============================================================

let queue = [];
let uploadHistory = JSON.parse(localStorage.getItem('suika_history') || '[]');
let deployHistory = JSON.parse(localStorage.getItem('suika_deploy_history') || '[]');
let selectedDeployFile = null;

// Ekstensi file yang boleh di-deploy jadi website. File .html otomatis
// di-rename jadi index.html supaya langsung kebuka di root domain.
const DEPLOY_ALLOWED_EXT = ['html', 'js', 'py', 'json', 'css', 'txt', 'php'];
const MAX_DEPLOY_SIZE_MB = 10;

const IG_CONFIG = {
  secretKeyHex: "34ac9a1aa6aaa7d69a7075611898f16a85d496b1d8f1c7aaa5640a2d93d7af80",
  appVersionTS: "1770240123231",
  userAgent: "Mozilla/5.0 (Linux; Android 10; RMX2185 Build/QP1A.190711.020) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.7559.109 Mobile Safari/537.36",
};
const CORS = "https://cors.yardansh.com/";


const VISITOR_COUNTER = {
  apiBase: 'https://countapi.mileshilliard.com/api/v1',
  key: `suika_${(GITHUB_CONFIG.owner || 'anon')}_${(GITHUB_CONFIG.repo || 'app')}_visitors`.toLowerCase().replace(/[^a-z0-9_\-.]/g, '_'),
};

// ============================================================
//  🔒 SECURITY SETTINGS
// ============================================================
// Batas ukuran upload per file (MB). Cegah upload file raksasa
// yang bisa bikin GitHub API error / boros kuota repo.
const MAX_UPLOAD_SIZE_MB = 25;

// Deterrent kosmetik (block klik-kanan & shortcut DevTools).
// PENTING: ini TIDAK menghentikan orang yang niat lihat source code —
// F12/klik-kanan cuma salah satu cara buka DevTools, menu browser
// (⋮ > More tools > Developer tools) selalu tetap bisa dipakai.
// Set true kalau tetap mau aktifin.
const SECURITY_UX_GUARD = false;

const YT_DL_APIS = {
  mp3: [
    { url: 'https://api.davidcyriltech.my.id/download/ytmp3?url=' },
    { url: 'https://api.siputzx.my.id/api/d/ytmp3?url=' },
  ],
  mp4: [
    { url: 'https://api.davidcyriltech.my.id/download/ytmp4?url=' },
    { url: 'https://api.siputzx.my.id/api/d/ytmp4?url=' },
  ],
};

