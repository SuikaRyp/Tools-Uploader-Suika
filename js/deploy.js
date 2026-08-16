// ============================================================
//  ▲ DEPLOY — upload file & deploy jadi website via Vercel API
// ============================================================

function isVercelConfigured() {
  return !!(
    VERCEL_CONFIG.token &&
    VERCEL_CONFIG.token !== 'vcp_1xEtQ9Iy5sL4eHSMg2OLKmaOTdkqhBlwWapgEFEN7HO0axvwi92mJXw0'
  );
}

function vercelHeaders(json = true) {
  const h = { Authorization: `Bearer ${VERCEL_CONFIG.token}` };
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

function vercelTeamQuery() {
  return VERCEL_CONFIG.teamId ? `?teamId=${encodeURIComponent(VERCEL_CONFIG.teamId)}` : '';
}

// ------------------------------------------------------------
//  DROPZONE — pilih 1 file buat di-deploy
// ------------------------------------------------------------

function handleDeployFile(files) {
  if (!files || !files.length) return;
  const file = files[0];
  const ext  = (file.name.split('.').pop() || '').toLowerCase();

  if (!DEPLOY_ALLOWED_EXT.includes(ext)) {
    toast(`⚠️ Format .${ext} tidak didukung. Hanya: ${DEPLOY_ALLOWED_EXT.join(', ')}`, 'error');
    return;
  }
  const maxMb = MAX_DEPLOY_SIZE_MB || 10;
  if (file.size > maxMb * 1024 * 1024) {
    toast(`❌ File > ${maxMb}MB, tidak bisa di-deploy`, 'error');
    return;
  }

  selectedDeployFile = file;
  renderDeployFile();

  // auto-isi nama project dari nama file kalau input masih kosong
  const nameInput = document.getElementById('dep-project-name');
  if (nameInput && !nameInput.value.trim()) {
    const base = file.name.replace(/\.[^.]+$/, '');
    nameInput.value = sanitizeProjectName(base);
  }
}

function renderDeployFile() {
  const card = document.getElementById('dep-file-card');
  const info = document.getElementById('dep-file-info');
  if (!selectedDeployFile) { card.style.display = 'none'; return; }

  const ext  = (selectedDeployFile.name.split('.').pop() || '').toLowerCase();
  const icon = ext === 'html' ? '🌐' : ext === 'js' ? '📜' : ext === 'py' ? '🐍' : ext === 'css' ? '🎨' : ext === 'json' ? '🗂️' : ext === 'php' ? '🐘' : '📄';

  card.style.display = 'block';
  info.innerHTML = `
    <div class="dep-file-row">
      <div class="dep-file-icon">${icon}</div>
      <div class="dep-file-meta">
        <div class="dep-file-name">${escapeHtml(selectedDeployFile.name)}</div>
        <div class="dep-file-sub">${fmtSize(selectedDeployFile.size)}${ext === 'html' ? ' · akan di-rename jadi <b>index.html</b>' : ''}</div>
      </div>
      <button class="q-remove" onclick="clearDeployFile()" title="Hapus file">✕</button>
    </div>`;
}

function clearDeployFile() {
  selectedDeployFile = null;
  const input = document.getElementById('dep-file-input');
  if (input) input.value = '';
  renderDeployFile();
}

function sanitizeProjectName(name) {
  return (name || '')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50) || `site${Date.now()}`;
}

// ------------------------------------------------------------
//  PROGRESS BAR
// ------------------------------------------------------------

function setDeployProgress(percent, label) {
  const wrap = document.getElementById('dep-progress-wrap');
  const bar  = document.getElementById('dep-progress-bar');
  const pct  = document.getElementById('dep-progress-pct');
  const lbl  = document.getElementById('dep-progress-label');
  if (!wrap) return;
  wrap.style.display = 'flex';
  bar.style.width = percent + '%';
  pct.textContent = Math.round(percent) + '%';
  if (label) lbl.textContent = label;
}

function resetDeployProgress() {
  const wrap = document.getElementById('dep-progress-wrap');
  if (wrap) wrap.style.display = 'none';
}

// ------------------------------------------------------------
//  DEPLOY
// ------------------------------------------------------------

async function startDeploy() {
  if (!isVercelConfigured()) return toast('Edit VERCEL_CONFIG di source code dulu!', 'error');
  if (!selectedDeployFile) return toast('Pilih file dulu buat di-deploy!', 'error');

  const btn = document.getElementById('dep-deploy-btn');
  const nameInput = document.getElementById('dep-project-name');
  let projectName = sanitizeProjectName(nameInput ? nameInput.value : '');

  btn.disabled = true;
  const originalBtnHtml = btn.innerHTML;
  btn.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px"></span> Deploying...';

  const file = selectedDeployFile;
  const ext  = (file.name.split('.').pop() || '').toLowerCase();
  const finalFileName = ext === 'html' ? 'index.html' : file.name;

  let ticker;
  try {
    setDeployProgress(8, '📖 Membaca file...');
    const base64 = await fileToBase64(file);

    setDeployProgress(22, '🏗️ Menyiapkan project di Vercel...');
    try {
      await axiosLikePost(
        `https://api.vercel.com/v9/projects${vercelTeamQuery()}`,
        { name: projectName, framework: null }
      );
    } catch (e) {
      if (e.code !== 'PROJECT_ALREADY_EXISTS') {
        console.warn('Project creation warning:', e);
      }
    }

    setDeployProgress(40, '☁️ Mengupload & men-deploy file...');
    let prog = 40;
    ticker = setInterval(() => {
      prog = Math.min(prog + 4, 88);
      setDeployProgress(prog, '☁️ Mengupload & men-deploy file...');
    }, 180);

    const payload = {
      name: projectName,
      files: [{ file: finalFileName, data: base64, encoding: 'base64' }],
      project: projectName,
      target: 'production',
    };

    const deployRes = await axiosLikePost(
      `https://api.vercel.com/v13/deployments${vercelTeamQuery()}`,
      payload
    );

    clearInterval(ticker);
    setDeployProgress(100, '✅ Deploy selesai!');

    const url = `https://${projectName}.vercel.app`;

    deployHistory.unshift({
      name: projectName,
      url,
      fileName: finalFileName,
      originalName: file.name,
      size: file.size,
      date: new Date().toISOString(),
    });
    localStorage.setItem('suika_deploy_history', JSON.stringify(deployHistory.slice(0, 100)));

    toast(`✅ ${projectName} berhasil di-deploy!`, 'success');
    clearDeployFile();
    if (nameInput) nameInput.value = '';
    setTimeout(resetDeployProgress, 1600);
    loadDeployments();

  } catch (e) {
    clearInterval(ticker);
    console.error('Deploy error:', e);
    setDeployProgress(100, '❌ Deploy gagal');
    const msg = e.message || 'Terjadi kesalahan saat deploy';
    toast(`❌ ${msg}`, 'error');
    setTimeout(resetDeployProgress, 1600);
  }

  btn.disabled = false;
  btn.innerHTML = originalBtnHtml;
}

// helper fetch->throw pattern mirip axios, biar pesan error konsisten
async function axiosLikePost(url, body) {
  const res = await fetch(url, { method: 'POST', headers: vercelHeaders(), body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error?.message || `Request gagal (${res.status})`);
    err.code = data?.error?.code;
    throw err;
  }
  return data;
}

// ------------------------------------------------------------
//  LIST DEPLOYMENTS
// ------------------------------------------------------------

async function loadDeployments() {
  updateVercelConnectionBadge();
  const listEl = document.getElementById('dep-list');
  if (!isVercelConfigured()) {
    listEl.innerHTML = `<div class="empty-state"><div class="em">▲</div>Belum konek ke Vercel.<br>Edit <code style="color:var(--lavender)">VERCEL_CONFIG</code> di source code dulu.</div>`;
    renderDeployStats([]);
    return;
  }

  listEl.innerHTML = `<div class="tt-loading"><div class="spinner"></div>Mengambil daftar deployment...</div>`;

  try {
    const res = await fetch(`https://api.vercel.com/v6/deployments?limit=30${VERCEL_CONFIG.teamId ? '&teamId=' + encodeURIComponent(VERCEL_CONFIG.teamId) : ''}`, {
      headers: vercelHeaders(false),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || 'Gagal mengambil daftar deployment');

    const deployments = data.deployments || [];
    renderDeployStats(deployments);
    renderDeployList(deployments);
  } catch (e) {
    console.error('List deploy error:', e);
    listEl.innerHTML = `<div class="glass-card" style="text-align:center;padding:32px;color:var(--error)">❌ ${escapeHtml(e.message)}</div>`;
    renderDeployStats([]);
  }
}

function renderDeployStats(deployments) {
  const total = deployments.length;
  const ready = deployments.filter(d => d.readyState === 'READY').length;
  const building = deployments.filter(d => d.readyState === 'BUILDING' || d.readyState === 'QUEUED' || d.readyState === 'INITIALIZING').length;
  const error = deployments.filter(d => d.readyState === 'ERROR' || d.readyState === 'CANCELED').length;

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('dep-stat-total', total);
  set('dep-stat-ready', ready);
  set('dep-stat-building', building);
  set('dep-stat-error', error);
}

function statusMeta(state) {
  switch (state) {
    case 'READY':    return { label: 'Ready',    cls: 'dep-dot-ready',    color: 'var(--success)' };
    case 'ERROR':    return { label: 'Error',     cls: 'dep-dot-error',    color: 'var(--error)' };
    case 'CANCELED': return { label: 'Canceled',  cls: 'dep-dot-error',    color: 'var(--error)' };
    case 'BUILDING': return { label: 'Building',  cls: 'dep-dot-building', color: 'var(--warn)' };
    case 'QUEUED':   return { label: 'Queued',    cls: 'dep-dot-building', color: 'var(--warn)' };
    case 'INITIALIZING': return { label: 'Initializing', cls: 'dep-dot-building', color: 'var(--warn)' };
    default:         return { label: state || 'Unknown', cls: 'dep-dot-idle', color: 'var(--muted)' };
  }
}

function timeAgo(ts) {
  const diff = Math.max(0, Date.now() - ts);
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'baru saja';
  if (min < 60) return `${min} menit lalu`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} jam lalu`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} hari lalu`;
  return new Date(ts).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function renderDeployList(deployments) {
  const listEl = document.getElementById('dep-list');
  if (!deployments.length) {
    listEl.innerHTML = `<div class="empty-state"><div class="em">🚀</div>Belum ada website yang di-deploy.<br>Upload file index.html di atas buat mulai!</div>`;
    return;
  }

  listEl.innerHTML = deployments.map((d) => {
    const meta = statusMeta(d.readyState);
    const url  = d.url ? `https://${d.url}` : '';
    const alias = `https://${d.name}.vercel.app`;
    const safeName = escapeHtml(d.name || 'Unnamed');
    const safeUrl  = escapeAttr(alias || url);
    return `
    <div class="dep-card">
      <div class="dep-card-top">
        <div class="dep-card-title">
          <span class="dep-dot ${meta.cls}"></span>
          <span class="dep-name" title="${safeName}">${safeName}</span>
        </div>
        <span class="dep-badge" style="color:${meta.color};border-color:${meta.color}44;background:${meta.color}1a">${meta.label}</span>
      </div>
      <a class="dep-url" href="${alias}" target="_blank" rel="noopener">${escapeHtml(alias.replace('https://', ''))} ↗</a>
      <div class="dep-card-meta">🕒 ${timeAgo(d.createdAt || d.created)}</div>
      <div class="dep-card-actions">
        <button class="dep-action-btn" onclick="window.open('${safeUrl}','_blank')">↗ Buka</button>
        <button class="dep-action-btn" onclick="copyLink('${safeUrl}',this)">📋 Copy</button>
        <button class="dep-action-btn danger" onclick="deleteDeployment('${escapeAttr(d.uid)}','${escapeAttr(d.name)}',this)">🗑 Hapus</button>
      </div>
    </div>`;
  }).join('');
}

async function deleteDeployment(uid, name, btn) {
  if (!confirm(`Hapus deployment "${name}"? Tindakan ini tidak bisa dibatalkan.`)) return;
  const card = btn.closest('.dep-card');
  btn.disabled = true;
  btn.textContent = '⏳';

  try {
    const res = await fetch(`https://api.vercel.com/v13/deployments/${uid}${vercelTeamQuery()}`, {
      method: 'DELETE',
      headers: vercelHeaders(false),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.error?.message || 'Gagal menghapus deployment');
    }
    toast(`🗑 ${name} dihapus`, 'info');
    if (card) card.remove();
    loadDeployments();
  } catch (e) {
    toast(`❌ ${e.message}`, 'error');
    btn.disabled = false;
    btn.textContent = '🗑 Hapus';
  }
}

function updateVercelConnectionBadge() {
  const el = document.getElementById('dep-connection-badge');
  if (!el) return;
  const ok = isVercelConfigured();
  el.innerHTML = ok
    ? `<span class="dep-conn-dot" style="background:var(--success);box-shadow:0 0 6px var(--success)"></span> Connected`
    : `<span class="dep-conn-dot" style="background:var(--muted)"></span> Not connected`;
  el.style.color = ok ? 'var(--success)' : 'var(--muted)';
}

// ------------------------------------------------------------
//  DROPZONE bindings (drag & drop)
// ------------------------------------------------------------
(function initDeployDropzone() {
  const dz = document.getElementById('dep-drop-zone');
  if (!dz) return;
  dz.addEventListener('dragover',  e => { e.preventDefault(); dz.classList.add('drag'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('drag'));
  dz.addEventListener('drop',      e => { e.preventDefault(); dz.classList.remove('drag'); handleDeployFile(e.dataTransfer.files); });
})();
