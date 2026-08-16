function isConfigured() {
  return !!(
    GITHUB_CONFIG.owner && GITHUB_CONFIG.repo && GITHUB_CONFIG.token &&
    GITHUB_CONFIG.owner !== 'YOUR_USERNAME' &&
    GITHUB_CONFIG.token !== 'YOUR_TOKEN'
  );
}

function dlFile(url, name) {
  const a = document.createElement('a');
  a.href = url; a.download = name; a.target = '_blank';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

async function deleteHistory(idx) {
  const f = uploadHistory[idx];
  if (!f) return;

  const fromGH = isConfigured() && (f.path || f.url);
  const msg = fromGH
    ? 'Hapus file ini dari history DAN dari GitHub?'
    : 'Hapus dari history? (File di GitHub tidak terhapus)';
  if (!confirm(msg)) return;

  // hapus dari GitHub
  if (fromGH) {
    try {
      // ekstrak path dari URL kalau tidak ada f.path
      let filePath = f.path;
      if (!filePath) {
        // format: https://raw.githubusercontent.com/owner/repo/branch/path...
        const match = f.url.match(/githubusercontent\.com\/[^/]+\/[^/]+\/[^/]+\/(.+)/);
        filePath = match ? match[1] : null;
      }

      if (filePath) {
        const apiUrl  = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${filePath}`;
        const headers = { Authorization: `token ${GITHUB_CONFIG.token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' };

        // ambil SHA file dulu
        const getRes  = await fetch(apiUrl, { headers });
        if (getRes.ok) {
          const getData = await getRes.json();
          const sha     = getData.sha;
          const delRes  = await fetch(apiUrl, {
            method: 'DELETE',
            headers,
            body: JSON.stringify({ message: `Delete: ${f.name}`, sha, branch: GITHUB_CONFIG.branch })
          });
          if (delRes.ok) {
            toast(`🗑 ${f.name} dihapus dari GitHub`, 'success');
          } else {
            const err = await delRes.json();
            toast(`⚠️ Gagal hapus dari GitHub: ${err.message}`, 'error');
          }
        } else {
          toast('⚠️ File tidak ditemukan di GitHub', 'error');
        }
      }
    } catch(e) {
      toast(`⚠️ Error: ${e.message}`, 'error');
    }
  }

  uploadHistory.splice(idx, 1);
  localStorage.setItem('suika_history', JSON.stringify(uploadHistory.slice(0, 100)));
  toast('Dihapus dari history', 'info');
  refreshStats();
  loadGallery();
}

async function hmacSHA256(keyHex, message) {
  const keyBytes  = hexToBytes(keyHex);
  const msgBytes  = new TextEncoder().encode(message);
  const cryptoKey = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig       = await crypto.subtle.sign('HMAC', cryptoKey, msgBytes);
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2,'0')).join('');
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) bytes[i/2] = parseInt(hex.substr(i,2), 16);
  return bytes;
}

async function fastDLDownload(igUrl) {
  const isStory = igUrl.includes('/stories/');
  let cleanUrl  = igUrl.split('?')[0];
  if (!cleanUrl.endsWith('/')) cleanUrl += '/';

  // 1. ambil cookie
  const homeRes  = await fetch(CORS + 'https://fastdl.app/id', { headers: { 'User-Agent': IG_CONFIG.userAgent } });
  const setCookie = homeRes.headers.get('set-cookie') || '';
  const cookieStr = setCookie.split(',').map(c => c.trim().split(';')[0]).join('; ');

  // 2. ambil server time
  const msecRes  = await fetch(CORS + 'https://fastdl.app/msec', { headers: { 'User-Agent': IG_CONFIG.userAgent, 'Cookie': cookieStr } });
  const msecData = await msecRes.json();
  const ts       = Math.floor(msecData.msec * 1000) - 450;

  // 3. buat HMAC signature
  const signSource = isStory ? JSON.stringify({ url: cleanUrl }) + ts : cleanUrl + ts;
  const signature  = await hmacSHA256(IG_CONFIG.secretKeyHex, signSource);

  const headers = {
    'User-Agent': IG_CONFIG.userAgent,
    'Origin': 'https://fastdl.app',
    'Cookie': cookieStr,
  };

  let response;
  if (isStory) {
    response = await fetch(CORS + 'https://api-wh.fastdl.app/api/v1/instagram/story', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json', 'Referer': 'https://fastdl.app/id/story-saver' },
      body: JSON.stringify({ url: cleanUrl, ts, _ts: IG_CONFIG.appVersionTS, _tsc: 0, _sv: 2, _s: signature }),
    });
  } else {
    const params = new URLSearchParams();
    params.append('sf_url', cleanUrl);
    params.append('ts', ts);
    params.append('_ts', IG_CONFIG.appVersionTS);
    params.append('_tsc', '0');
    params.append('_sv', '2');
    params.append('_s', signature);
    response = await fetch(CORS + 'https://api-wh.fastdl.app/api/convert', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8', 'Referer': 'https://fastdl.app/id' },
      body: params.toString(),
    });
  }
  return response.json();
}

function formatStoryResult(data) {
  const r = data.result[0];
  const media = [];
  if (r.video_versions?.length)      media.push({ type: 'video', url: r.video_versions[0].url_wrapped || r.video_versions[0].url });
  if (r.image_versions2?.candidates?.length) media.push({ type: 'image', url: r.image_versions2.candidates[0].url_wrapped || r.image_versions2.candidates[0].url });
  return { username: r.user?.username || '-', thumbnail: r.image_versions2?.candidates?.[0]?.url || '', media };
}

function formatPostResult(data) {
  const isArray = Array.isArray(data);
  const first   = isArray ? data[0] : data;
  const media   = [];
  if (isArray) {
    data.forEach(item => { if (item.url?.length) media.push({ type: item.url[0].type || 'image', url: item.url[0].url || item.hd || item.sd }); });
  } else {
    if (data.url?.length) media.push({ type: data.url[0].type || 'image', url: data.url[0].url || data.hd || data.sd });
  }
  const meta = first?.meta || null;
  return {
    title:     meta?.title     || '-',
    likes:     meta?.like_count  || '-',
    comment:   meta?.comment_count || '-',
    username:  meta?.username  || '-',
    thumbnail: first?.thumb    || '',
    media,
  };
}

async function igDownload() {
  const url = document.getElementById('ig-url-input').value.trim();
  if (!url) return toast('Masukkan URL Instagram dulu!', 'error');
  if (!url.includes('instagram.com')) return toast('URL bukan dari Instagram!', 'error');

  const resultEl = document.getElementById('ig-result');
  const btn      = document.getElementById('ig-btn');
  btn.disabled   = true;
  resultEl.innerHTML = `<div class="tt-loading"><div class="spinner"></div>Fetching via fastdl.app...</div>`;

  try {
    const raw      = await fastDLDownload(url);
    const isStory  = url.includes('/stories/');
    const result   = isStory ? formatStoryResult(raw) : formatPostResult(raw);

    if (!result.media?.length) {
      resultEl.innerHTML = `<div class="glass-card" style="text-align:center;padding:32px;color:var(--error)">❌ Gagal mengambil media. Coba link lain atau pastikan postingan publik.</div>`;
      btn.disabled = false;
      return;
    }

    // build info bar
    let infoHtml = '';
    if (result.username && result.username !== '-') infoHtml += `👤 @${result.username}`;
    if (result.likes    && result.likes    !== '-') infoHtml += ` &nbsp;❤️ ${result.likes}`;
    if (result.comment  && result.comment  !== '-') infoHtml += ` &nbsp;💬 ${result.comment}`;
    if (result.title    && result.title    !== '-') infoHtml = `<div class="tt-title">📍 ${result.title}</div>` + (infoHtml ? `<div class="tt-author">${infoHtml}</div>` : '');

    if (result.media.length === 1) {
      const item  = result.media[0];
      const isVid = item.type === 'video' || item.type === 'mp4';
      resultEl.innerHTML = `
        <div class="tt-result-card">
          <div class="tt-media-wrap">
            ${isVid
              ? `<video controls preload="metadata" poster="${result.thumbnail}"><source src="${item.url}" type="video/mp4"></video>`
              : `<img src="${item.url}" style="width:100%;max-height:420px;object-fit:contain">`}
          </div>
          <div class="tt-info">
            ${infoHtml}
            <div class="tt-actions" style="margin-top:12px">
              <a class="tt-dl-btn primary" href="${item.url}" download="${isVid?'ig_video.mp4':'ig_photo.jpg'}" target="_blank">⬇️ Download ${isVid?'Video':'Foto'}</a>
            </div>
          </div>
        </div>`;
    } else {
      const grid = result.media.map((item, i) => {
        const isVid = item.type === 'video' || item.type === 'mp4';
        return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;overflow:hidden">
          ${isVid
            ? `<video src="${item.url}" style="width:100%;height:160px;object-fit:cover" muted playsinline></video>`
            : `<img src="${item.url}" style="width:100%;height:160px;object-fit:cover" loading="lazy">`}
          <div style="padding:8px">
            <a class="tt-dl-btn ghost" style="width:100%;justify-content:center;font-size:12px"
              href="${item.url}" download="ig_${i+1}.${isVid?'mp4':'jpg'}" target="_blank">
              ⬇️ ${isVid?'Video':'Foto'} ${i+1}
            </a>
          </div>
        </div>`;
      }).join('');

      resultEl.innerHTML = `
        <div class="tt-result-card">
          <div class="tt-info" style="padding-bottom:4px">
            ${infoHtml}
            <div class="tt-author" style="margin-top:4px">📦 ${result.media.length} item dalam postingan ini</div>
          </div>
          <div class="tt-images-grid" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))">${grid}</div>
        </div>`;
    }
  } catch(e) {
    resultEl.innerHTML = `<div class="glass-card" style="text-align:center;padding:32px;color:var(--error)">❌ Error: ${e.message}</div>`;
  }
  btn.disabled = false;
}

async function forceDownload(url, filename) {
  try {
    toast('Memulai download...', 'info');
    const res  = await fetch(url);
    const blob = await res.blob();
    const burl = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = burl; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(burl), 5000);
    toast('Download selesai! ✅', 'success');
  } catch(e) {
    toast('Gagal download: ' + e.message, 'error');
  }
}

async function ttDownload() {
  const url = document.getElementById('tt-url-input').value.trim();
  if (!url) return toast('Masukkan URL TikTok dulu!', 'error');
  if (!url.includes('tiktok.com')) return toast('URL bukan dari TikTok!', 'error');

  const result = document.getElementById('tt-result');
  const btn    = document.getElementById('tt-btn');
  btn.disabled = true;
  result.innerHTML = `<div class="tt-loading"><div class="spinner"></div>Fetching...</div>`;

  try {
    // menggunakan API publik tikwm
    const api = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`;
    const res  = await fetch(api);
    const data = await res.json();

    if (data.code !== 0 || !data.data) {
      result.innerHTML = `<div class="glass-card" style="text-align:center;padding:32px;color:var(--error)">❌ Gagal fetch. Coba link lain.</div>`;
      btn.disabled = false;
      return;
    }

    const d = data.data;
    const isSlide = d.images && d.images.length > 0;
    const title   = d.title || '-';
    const author  = `${d.author?.nickname || ''} (@${d.author?.unique_id || ''})`;
    const created = d.create_time ? new Date(d.create_time * 1000).toLocaleDateString('id-ID') : '-';

    if (isSlide) {
      // slideshow / images
      const imgGrid = d.images.map((img, i) =>
        `<a href="${img}" download="tiktok_img_${i+1}.jpg" target="_blank">
          <img src="${img}" loading="lazy" onerror="this.style.opacity=0.3" title="Klik untuk download">
        </a>`
      ).join('');
      result.innerHTML = `
        <div class="tt-result-card">
          <div class="tt-images-grid">${imgGrid}</div>
          <div class="tt-info">
            <div class="tt-title">📍 ${title}</div>
            <div class="tt-author">🎃 ${author} · 🕓 ${created}</div>
            <div class="tt-actions">
              <button class="tt-dl-btn ghost" onclick="ttDownloadAll(${JSON.stringify(d.images).replace(/"/g,'&quot;')})">⬇️ Download Semua (${d.images.length} foto)</button>
            </div>
          </div>
        </div>`;
    } else {
      // video
      const videoHD  = d.hdplay || d.play || '';
      const videoSD  = d.play   || '';
      const musicUrl = d.music  || '';
      result.innerHTML = `
        <div class="tt-result-card">
          <div class="tt-media-wrap">
            <video controls preload="metadata" poster="${d.cover || ''}">
              <source src="${videoHD}" type="video/mp4">
            </video>
          </div>
          <div class="tt-info">
            <div class="tt-title">📍 ${title}</div>
            <div class="tt-author">🎃 ${author} · 🕓 ${created}</div>
            <div class="tt-actions">
              <button class="tt-dl-btn primary" onclick="forceDownload('${videoHD}','tiktok_hd.mp4')">⬇️ Download HD</button>
              ${videoSD && videoSD !== videoHD ? `<button class="tt-dl-btn ghost" onclick="forceDownload('${videoSD}','tiktok_sd.mp4')">⬇️ SD</button>` : ''}
              ${musicUrl ? `<button class="tt-dl-btn ghost" onclick="forceDownload('${musicUrl}','tiktok_audio.mp3')">🎵 Audio</button>` : ''}
            </div>
          </div>
        </div>`;
    }
  } catch(e) {
    result.innerHTML = `<div class="glass-card" style="text-align:center;padding:32px;color:var(--error)">❌ Error: ${e.message}</div>`;
  }
  btn.disabled = false;
}

async function ttDownloadAll(images) {
  toast(`Mengunduh ${images.length} gambar...`, 'info');
  for (let i = 0; i < images.length; i++) {
    await new Promise(r => setTimeout(r, 400));
    const a = document.createElement('a');
    a.href = images[i]; a.download = `tiktok_img_${i+1}.jpg`; a.target = '_blank';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }
  toast('Semua gambar diunduh!', 'success');
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function sanitizeFilename(name) {
  return String(name || 'youtube').replace(/[^a-zA-Z0-9._\- ]/g, '').trim().slice(0, 80) || 'youtube';
}

// scrape halaman hasil pencarian YouTube (cara kerja yang sama dengan lib "yts")
async function ytSearch() {
  const q = document.getElementById('yt-search-input').value.trim();
  if (!q) return toast('Masukkan kata kunci pencarian dulu!', 'error');

  const resultEl = document.getElementById('yt-search-result');
  const btn      = document.getElementById('yt-search-btn');
  btn.disabled   = true;
  resultEl.innerHTML = `<div class="tt-loading"><div class="spinner"></div>Mencari di YouTube...</div>`;

  try {
    const res  = await fetch(CORS + 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q) + '&hl=en', {
      headers: { 'Accept-Language': 'en-US,en;q=0.9' }
    });
    const html = await res.text();

    const match = html.match(/var ytInitialData\s*=\s*(\{.+?\});<\/script>/s);
    if (!match) throw new Error('Gagal parsing hasil pencarian');
    const data = JSON.parse(match[1]);

    const sections = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];
    const videos = [];
    for (const section of sections) {
      const items = section?.itemSectionRenderer?.contents || [];
      for (const item of items) {
        const v = item.videoRenderer;
        if (!v || !v.videoId) continue;
        videos.push({
          videoId:   v.videoId,
          title:     v.title?.runs?.[0]?.text || v.title?.simpleText || 'Tidak tersedia',
          channel:   v.ownerText?.runs?.[0]?.text || v.longBylineText?.runs?.[0]?.text || 'Tidak tersedia',
          duration:  v.lengthText?.simpleText || 'LIVE',
          views:     v.viewCountText?.simpleText || v.shortViewCountText?.simpleText || '',
          published: v.publishedTimeText?.simpleText || '',
          thumbnail: v.thumbnail?.thumbnails?.slice(-1)?.[0]?.url || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
        });
        if (videos.length >= 15) break;
      }
      if (videos.length >= 15) break;
    }

    if (!videos.length) {
      resultEl.innerHTML = `<div class="glass-card" style="text-align:center;padding:32px;color:var(--error)">❌ Tidak ada hasil untuk "${escapeHtml(q)}"</div>`;
      btn.disabled = false;
      return;
    }

    resultEl.innerHTML = `<div class="yt-grid">${videos.map(renderYtCard).join('')}</div>`;
  } catch (e) {
    resultEl.innerHTML = `<div class="glass-card" style="text-align:center;padding:32px;color:var(--error)">❌ Error: ${escapeHtml(e.message)}</div>`;
  }
  btn.disabled = false;
}

function renderYtCard(v) {
  const safeTitle = escapeHtml(v.title);
  const safeChannel = escapeHtml(v.channel);
  const meta = [v.channel, v.views, v.published].filter(Boolean).map(escapeHtml).join(' · ');
  return `
    <div class="yt-card">
      <div class="yt-thumb-wrap">
        <img src="${v.thumbnail}" loading="lazy" alt="${safeTitle}">
        <span class="yt-duration-badge">${escapeHtml(v.duration)}</span>
      </div>
      <div class="yt-card-body">
        <div class="yt-card-title" title="${safeTitle}">${safeTitle}</div>
        <div class="yt-card-meta">${meta}</div>
        <div class="yt-card-actions">
          <button class="tt-dl-btn primary" onclick="ytDownload('${v.videoId}','${safeTitle.replace(/'/g, "\\'")}','mp4',this)">⬇️ MP4</button>
          <button class="tt-dl-btn ghost" onclick="ytDownload('${v.videoId}','${safeTitle.replace(/'/g, "\\'")}','mp3',this)">🎵 MP3</button>
        </div>
      </div>
    </div>`;
}

async function ytDownload(videoId, title, type, btn) {
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner" style="width:12px;height:12px;border-width:2px;display:inline-block;vertical-align:middle"></span>`;

  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const endpoints = YT_DL_APIS[type] || [];

  let downloadUrl = null;
  for (const ep of endpoints) {
    try {
      const res  = await fetch(CORS + ep.url + encodeURIComponent(videoUrl));
      const json = await res.json();
      downloadUrl = extractYtDownloadUrl(json);
      if (downloadUrl) break;
    } catch (e) { /* coba endpoint berikutnya */ }
  }

  if (downloadUrl) {
    await forceDownload(downloadUrl, `${sanitizeFilename(title)}.${type}`);
  } else {
    toast(`❌ Gagal download ${type.toUpperCase()}. API downloader mungkin sedang down — coba lagi nanti atau ganti endpoint di config.js`, 'error');
  }

  btn.disabled = false;
  btn.innerHTML = original;
}

// beberapa API publik punya bentuk response berbeda-beda, jadi dicoba beberapa kemungkinan path umum
function extractYtDownloadUrl(json) {
  if (!json) return null;
  const candidates = [
    json?.result?.download?.url,
    json?.result?.downloadUrl,
    json?.result?.download,
    json?.result?.url,
    json?.result?.mp3,
    json?.result?.mp4,
    json?.data?.download?.url,
    json?.data?.downloadUrl,
    json?.data?.url,
    json?.download?.url,
    json?.downloadUrl,
    json?.url,
    json?.dl_link,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.startsWith('http')) return c;
  }
  return null;
}

// ============================================================
//  VISITOR COUNTER
// ============================================================

// dipanggil sekali saat app dimuat: increment cuma 1x per sesi browser,
// tapi selalu refresh angka yang ditampilkan
async function initVisitorCounter() {
  const alreadyCounted = sessionStorage.getItem('suika_visit_counted');
  try {
    if (!alreadyCounted) {
      const res  = await fetch(`${VISITOR_COUNTER.apiBase}/hit/${VISITOR_COUNTER.key}`);
      const data = await res.json();
      const val  = data.value ?? data.count;
      if (typeof val === 'number') {
        localStorage.setItem('suika_visit_cache', val);
        sessionStorage.setItem('suika_visit_counted', '1');
      }
    } else {
      const res  = await fetch(`${VISITOR_COUNTER.apiBase}/get/${VISITOR_COUNTER.key}`);
      const data = await res.json();
      const val  = data.value ?? data.count;
      if (typeof val === 'number') localStorage.setItem('suika_visit_cache', val);
    }
  } catch (e) {
    // API lagi down, biarin pake cache localStorage terakhir
  }
  renderVisitorCount();
}

function renderVisitorCount() {
  const el = document.getElementById('stat-visitors');
  if (!el) return;
  const cached = localStorage.getItem('suika_visit_cache');
  el.textContent = cached !== null ? cached : '—';
}

async function refreshVisitorCount() {
  try {
    const res  = await fetch(`${VISITOR_COUNTER.apiBase}/get/${VISITOR_COUNTER.key}`);
    const data = await res.json();
    const val  = data.value ?? data.count;
    if (typeof val === 'number') localStorage.setItem('suika_visit_cache', val);
  } catch (e) { /* pakai cache lama */ }
  renderVisitorCount();
}

// ============================================================
//  NAVIGATION
// ============================================================

async function startUpload() {
  if (!isConfigured()) return toast('Edit GITHUB_CONFIG di source code dulu!', 'error');

  const btn = document.getElementById('upload-btn');
  btn.disabled = true;
  btn.textContent = '⬆️ Uploading...';

  for (const item of queue) {
    if (item.status === 'done') continue;
    await uploadFile(item);
  }

  btn.disabled = false;
  btn.textContent = '🚀 Upload All';
  toast('All files processed!', 'success');
  refreshStats();
}

async function uploadFile(item) {
  item.status = 'uploading';
  updateQueueItem(item);

  try {
    const b64  = await fileToBase64(item.file);
    const path = `${GITHUB_CONFIG.folder}/${Date.now()}_${item.file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const url  = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${path}`;
    const headers = { Authorization: `token ${GITHUB_CONFIG.token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' };

    // Check existing SHA
    let sha = null;
    try {
      const check = await fetch(url, { headers });
      if (check.ok) { const d = await check.json(); sha = d.sha; }
    } catch {}

    const body = { message: `Upload: ${item.file.name}`, content: b64, branch: GITHUB_CONFIG.branch };
    if (sha) body.sha = sha;

    let prog = 0;
    const ticker = setInterval(() => {
      prog = Math.min(prog + 10, 85);
      item.progress = prog;
      const pb = document.getElementById('qp-' + item.id);
      if (pb) pb.style.width = prog + '%';
    }, 150);

    const res = await fetch(url, { method: 'PUT', headers, body: JSON.stringify(body) });
    clearInterval(ticker);

    if (res.ok) {
      const data = await res.json();
      item.status  = 'done';
      item.progress = 100;
      item.rawUrl  = data.content.download_url;

      uploadHistory.unshift({
        name: item.file.name,
        type: item.file.type,
        size: item.file.size,
        url:  data.content.download_url,
        path: data.content.path,
        date: new Date().toISOString()
      });
      localStorage.setItem('suika_history', JSON.stringify(uploadHistory.slice(0, 100)));
      toast(`✅ ${item.file.name} uploaded!`, 'success');
    } else {
      const err = await res.json();
      item.status = 'error';
      toast(`❌ ${item.file.name}: ${err.message}`, 'error');
    }
  } catch (e) {
    item.status = 'error';
    toast(`❌ ${item.file.name}: ${e.message}`, 'error');
  }

  updateQueueItem(item);
}

