// ============================================================
//  SECURITY HELPERS
//  1) escapeHtml / escapeAttr -> cegah XSS dari nama file / input user
//  2) Deterrent ringan (klik kanan, devtools shortcut) -> KOSMETIK,
//     bukan proteksi asli. Orang yang niat tetap bisa buka DevTools
//     via menu browser. Jangan andalkan ini buat nyembunyiin secret.
// ============================================================

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Buat dipakai di dalam onclick="fn('...')" -> escape quote & backslash
// dulu (JS string context), BARU escape buat HTML attribute context.
function escapeAttr(str) {
  if (str === null || str === undefined) return '';
  const jsSafe = String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  return escapeHtml(jsSafe);
}

// ------------------------------------------------------------
//  Deterrent ringan — TIDAK menghentikan orang yang niat.
//  Aktifkan lewat SECURITY_UX_GUARD di config.js kalau mau.
// ------------------------------------------------------------
(function initUxGuard() {
  if (typeof SECURITY_UX_GUARD === 'undefined' || !SECURITY_UX_GUARD) return;

  document.addEventListener('contextmenu', e => e.preventDefault());

  document.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    const blocked =
      k === 'f12' ||
      (e.ctrlKey && e.shiftKey && (k === 'i' || k === 'j' || k === 'c')) ||
      (e.ctrlKey && k === 'u');
    if (blocked) e.preventDefault();
  });
})();
