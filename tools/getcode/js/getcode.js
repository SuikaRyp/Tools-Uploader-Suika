const PROXY_1 = 'https://cors.yardansh.com/';
const PROXY_2_BASE = 'https://api.allorigins.win/raw?url=';

const FETCH_TIMEOUT_MS = 30000;
const MAX_FILES = 100;
const STAGGER_MS = 250;

const WANTED_EXT = /\.(js|css|png|jpe?g|gif|svg|ico|webp|woff2?|ttf|eot|html?|mp4|webm|ogg|mp3|json)(\?.*)?$/i;
const CSS_URL_RE = /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi;

let cancelled = false;
let running = false;
let zipFiles = [];   // { name, blob }
let failedCount = 0;

function toast(msg, type = 'info') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity 0.3s'; setTimeout(() => t.remove(), 300); }, 3500);
}

function normalizeUrl(raw) {
  let u = raw.trim();
  if (!u) return null;
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  try { return new URL(u).href; } catch { return null; }
}

function isOnlineUrl(u) { return /^https?:\/\//i.test(u); }

function resolveUrl(relative, base) {
  try { return new URL(relative, base).href; } catch { return null; }
}

function sanitizeFilename(name) {
  return (name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}

function uniqueName(name, usedNames) {
  let n = name;
  let i = 1;
  while (usedNames.has(n)) {
    const dot = name.lastIndexOf('.');
    n = dot > 0 ? `${name.slice(0, dot)}_${i}${name.slice(dot)}` : `${name}_${i}`;
    i++;
  }
  usedNames.add(n);
  return n;
}

function fmtBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)),
  ]);
}

// Coba metode 1 (proxy utama), kalau gagal fallback ke metode 2 (proxy cadangan)
async function fetchViaProxy(targetUrl, responseType) {
  const attempt = async (proxyUrl, methodNo) => {
    const res = await withTimeout(fetch(proxyUrl), FETCH_TIMEOUT_MS);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = responseType === 'arraybuffer' ? await res.arrayBuffer() : await res.text();
    return { data, method: methodNo };
  };

  try {
    return await attempt(PROXY_1 + targetUrl, 1);
  } catch (e1) {
    try {
      return await attempt(PROXY_2_BASE + encodeURIComponent(targetUrl), 2);
    } catch (e2) {
      throw new Error(`Gagal via kedua metode (${e1.message} / ${e2.message})`);
    }
  }
}

function extractResources(htmlText, baseUrl) {
  const urls = new Set();
  const doc = new DOMParser().parseFromString(htmlText, 'text/html');

  const addAttr = (selector, attr) => {
    doc.querySelectorAll(selector).forEach((el) => {
      const v = el.getAttribute(attr);
      if (v) urls.add(v);
    });
  };

  addAttr('script[src]', 'src');
  addAttr('link[href]', 'href');           // css, icon, preload, manifest
  addAttr('img[src]', 'src');
  addAttr('img[data-src]', 'data-src');
  addAttr('source[src]', 'src');
  addAttr('video[src]', 'src');
  addAttr('audio[src]', 'src');
  addAttr('meta[property="og:image"]', 'content');
  addAttr('meta[name="twitter:image"]', 'content');

  doc.querySelectorAll('img[srcset], source[srcset]').forEach((el) => {
    (el.getAttribute('srcset') || '').split(',').forEach((part) => {
      const u = part.trim().split(/\s+/)[0];
      if (u) urls.add(u);
    });
  });

  doc.querySelectorAll('[style]').forEach((el) => {
    const style = el.getAttribute('style') || '';
    let m;
    const re = new RegExp(CSS_URL_RE.source, 'gi');
    while ((m = re.exec(style))) urls.add(m[2]);
  });

  doc.querySelectorAll('style').forEach((el) => {
    let m;
    const re = new RegExp(CSS_URL_RE.source, 'gi');
    while ((m = re.exec(el.textContent || ''))) urls.add(m[2]);
  });

  return Array.from(urls)
    .map((raw) => resolveUrl(raw, baseUrl))
    .filter((u) => u && isOnlineUrl(u) && WANTED_EXT.test(u));
}

function extractCssResources(cssText, cssFileUrl) {
  const urls = new Set();
  let m;
  const re = new RegExp(CSS_URL_RE.source, 'gi');
  while ((m = re.exec(cssText))) {
    if (m[2].startsWith('data:')) continue;
    urls.add(m[2]);
  }
  return Array.from(urls)
    .map((raw) => resolveUrl(raw, cssFileUrl))
    .filter((u) => u && isOnlineUrl(u) && WANTED_EXT.test(u));
}

function addLogRow(id, icon, name, tagText, tagClass) {
  const list = document.getElementById('gc-log-list');
  const row = document.createElement('div');
  row.className = 'gc-log-item';
  row.id = id;
  row.innerHTML = `
    <span class="gc-log-icon">${icon}</span>
    <span class="gc-log-name" title="${name}">${name}</span>
    <span class="gc-log-tag ${tagClass}">${tagText}</span>
  `;
  list.appendChild(row);
  list.scrollTop = list.scrollHeight;
  return row;
}

function updateLogRow(id, icon, tagText, tagClass) {
  const row = document.getElementById(id);
  if (!row) return;
  row.querySelector('.gc-log-icon').textContent = icon;
  const tag = row.querySelector('.gc-log-tag');
  tag.textContent = tagText;
  tag.className = `gc-log-tag ${tagClass}`;
}

function setProgress(done, total) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  document.getElementById('gc-progress-bar').style.width = pct + '%';
}

const STEP_IDS = ['connect', 'html', 'assets', 'zip', 'done'];

function setStep(stepId, status, subText) {
  const el = document.getElementById('gc-step-' + stepId);
  if (!el) return;
  el.dataset.status = status;
  if (subText) el.querySelector('.gc-step-sub').textContent = subText;
}

function resetSteps() {
  STEP_IDS.forEach((id) => setStep(id, 'pending', 'Menunggu giliran...'));
}

async function startGetCode() {
  if (running) return;
  const raw = document.getElementById('gc-url').value;
  const startUrl = normalizeUrl(raw);
  if (!startUrl) { toast('URL tidak valid', 'error'); return; }

  running = true;
  cancelled = false;
  zipFiles = [];
  failedCount = 0;

  document.getElementById('gc-empty-state').style.display = 'none';
  document.getElementById('gc-result-card').style.display = 'none';
  document.getElementById('gc-progress-card').style.display = 'block';
  document.getElementById('gc-cancel-btn').style.display = '';
  document.getElementById('gc-log-list').innerHTML = '';
  document.getElementById('gc-start-btn').disabled = true;
  document.getElementById('gc-progress-sub').textContent = 'Menyiapkan...';
  resetSteps();
  setProgress(0, 1);

  const usedNames = new Set();

  // STEP 1: Menghubungi website
  setStep('connect', 'active', 'Menghubungi ' + new URL(startUrl).hostname + '...');
  document.getElementById('gc-progress-sub').textContent = 'Sedang mengambil source code...';

  let html, mainMethod;
  const rowMain = addLogRow('gc-row-main', '⏳', 'index.html (halaman utama)', 'proses', 'gc-tag-pending');
  try {
    const r = await fetchViaProxy(startUrl, 'text');
    html = r.data;
    mainMethod = r.method;
    zipFiles.push({ name: uniqueName('index.html', usedNames), blob: new Blob([html], { type: 'text/html' }) });
    updateLogRow('gc-row-main', '✅', mainMethod === 1 ? 'ok' : 'ok · metode 2', mainMethod === 1 ? 'gc-tag-ok' : 'gc-tag-method2');
    setStep('connect', 'done', 'Terhubung' + (mainMethod === 2 ? ' (via proxy cadangan)' : ''));
  } catch (e) {
    setStep('connect', 'error', 'Gagal menghubungi website');
    updateLogRow('gc-row-main', '❌', 'gagal', 'gc-tag-fail');
    toast('Gagal mengambil halaman utama: ' + e.message, 'error');
    failRun();
    return;
  }

  if (cancelled) { finishRun(startUrl); return; }

  // STEP 2: HTML didapat
  setStep('html', 'active', 'Memproses isi halaman...');
  await new Promise((r) => setTimeout(r, 200)); // biar animasinya kelihatan, bukan instan
  setStep('html', 'done', 'HTML berhasil didapat (' + fmtBytes(new Blob([html]).size) + ')');

  // STEP 3: Ekstrak & unduh semua resource (CSS, JS, gambar, font, dst)
  let queue = extractResources(html, startUrl);
  const visited = new Set([startUrl]);
  queue = queue.filter((u) => !visited.has(u));
  queue = queue.slice(0, MAX_FILES);

  if (queue.length === 0) {
    setStep('assets', 'done', 'Tidak ada resource tambahan ditemukan');
  } else {
    setStep('assets', 'active', `0/${queue.length} file`);
    document.getElementById('gc-progress-sub').textContent = 'Mendapatkan CSS, JS & aset lainnya...';
  }

  let idx = 0;
  while (idx < queue.length && idx < MAX_FILES) {
    if (cancelled) break;
    const fileUrl = queue[idx];
    idx++;
    if (visited.has(fileUrl)) continue;
    visited.add(fileUrl);

    const rowId = 'gc-row-' + idx;
    let displayName;
    try { displayName = new URL(fileUrl).pathname.split('/').pop() || fileUrl; } catch { displayName = fileUrl; }
    addLogRow(rowId, '⏳', displayName, 'proses', 'gc-tag-pending');
    setProgress(idx, queue.length);
    setStep('assets', 'active', `${idx}/${queue.length} file · ${displayName}`);

    try {
      const r = await fetchViaProxy(fileUrl, 'arraybuffer');
      const filename = uniqueName(sanitizeFilename(displayName), usedNames);
      const blob = new Blob([r.data]);
      zipFiles.push({ name: filename, blob });
      updateLogRow(rowId, '✅', r.method === 1 ? 'ok' : 'ok · metode 2', r.method === 1 ? 'gc-tag-ok' : 'gc-tag-method2');

      // Kalau ini file CSS, scan lagi isinya buat cari resource tambahan (font, bg image dll)
      if (/\.css(\?.*)?$/i.test(fileUrl) && queue.length < MAX_FILES) {
        try {
          const cssText = new TextDecoder().decode(r.data);
          const more = extractCssResources(cssText, fileUrl).filter((u) => !visited.has(u) && !queue.includes(u));
          for (const u of more) {
            if (queue.length >= MAX_FILES) break;
            queue.push(u);
          }
        } catch {}
      }
    } catch (e) {
      failedCount++;
      updateLogRow(rowId, '❌', 'gagal', 'gc-tag-fail');
    }

    if (idx < queue.length) await new Promise((r) => setTimeout(r, STAGGER_MS));
  }

  setStep('assets', 'done', `${zipFiles.length - 1} file berhasil${failedCount ? `, ${failedCount} gagal` : ''}`);

  finishRun(startUrl);
}

async function finishRun(startUrl) {
  running = false;
  document.getElementById('gc-start-btn').disabled = false;

  if (zipFiles.length === 0) {
    document.getElementById('gc-progress-card').style.display = 'none';
    document.getElementById('gc-empty-state').style.display = 'block';
    toast('Gak ada file yang berhasil diambil', 'error');
    return;
  }

  // STEP 4: Membungkus jadi ZIP
  document.getElementById('gc-cancel-btn').style.display = 'none';
  setStep('zip', 'active', 'Mengompres ' + zipFiles.length + ' file...');
  document.getElementById('gc-progress-sub').textContent = 'Membungkus jadi ZIP...';

  let blob;
  try {
    const zip = new JSZip();
    zipFiles.forEach((f) => zip.file(f.name, f.blob));
    blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  } catch (e) {
    setStep('zip', 'error', 'Gagal mengemas ZIP');
    document.getElementById('gc-progress-card').style.display = 'none';
    document.getElementById('gc-empty-state').style.display = 'block';
    toast('Gagal mengemas ZIP: ' + e.message, 'error');
    return;
  }

  setStep('zip', 'done', 'ZIP siap (' + fmtBytes(blob.size) + ')');

  window._gcZipBlob = blob;
  window._gcZipName = (() => {
    try { return new URL(startUrl).hostname.replace(/[^a-z0-9.-]/gi, '_') + '.zip'; }
    catch { return 'source.zip'; }
  })();

  document.getElementById('gc-stat-total').textContent = zipFiles.length;
  document.getElementById('gc-stat-failed').textContent = failedCount;
  document.getElementById('gc-stat-size').textContent = fmtBytes(blob.size);

  // STEP 5: Selesai
  setStep('done', 'active');
  await new Promise((r) => setTimeout(r, 250));
  setStep('done', 'done');
  await new Promise((r) => setTimeout(r, 200));

  document.getElementById('gc-progress-card').style.display = 'none';
  document.getElementById('gc-cancel-btn').style.display = '';
  document.getElementById('gc-result-card').style.display = 'block';

  showSuccessOverlay(zipFiles.length, failedCount);

  // Auto-trigger download begitu berhasil, tombol tetap ada buat unduh ulang
  downloadZip();
}

function failRun() {
  running = false;
  document.getElementById('gc-start-btn').disabled = false;
  document.getElementById('gc-cancel-btn').style.display = '';
  setTimeout(() => {
    document.getElementById('gc-progress-card').style.display = 'none';
    document.getElementById('gc-empty-state').style.display = 'block';
  }, 900);
}

function showSuccessOverlay(count, failed) {
  const overlay = document.getElementById('gc-success-overlay');
  document.getElementById('gc-success-sub').textContent =
    `${count} file berhasil diambil` + (failed ? `, ${failed} gagal` : '') + ' — ZIP otomatis ke-download';
  overlay.style.display = 'flex';
  clearTimeout(window._gcOverlayTimer);
  window._gcOverlayTimer = setTimeout(closeSuccessOverlay, 4500);
}

function closeSuccessOverlay() {
  document.getElementById('gc-success-overlay').style.display = 'none';
  clearTimeout(window._gcOverlayTimer);
}

function downloadZip() {
  if (!window._gcZipBlob) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(window._gcZipBlob);
  a.download = window._gcZipName || 'source.zip';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function cancelGetCode() {
  cancelled = true;
  toast('Membatalkan...', 'info');
}

function resetGetCode() {
  document.getElementById('gc-result-card').style.display = 'none';
  document.getElementById('gc-empty-state').style.display = 'block';
  document.getElementById('gc-url').value = '';
  window._gcZipBlob = null;
  resetSteps();
}

