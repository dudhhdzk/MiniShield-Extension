const api = typeof browser !== 'undefined' ? browser : chrome;
function escHtml(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}
function toast() {
  const t = document.getElementById('toast');
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 1200);
}
const t = (key, fb) => {
  try {
    const m = api.i18n.getMessage(key);
    return m || fb || key;
  } catch {
    return fb || key;
  }
};

const PF = [
  'firstName',
  'lastName',
  'email',
  'phone',
  'username',
  'birthDate',
  'country',
  'city',
  'organization',
  'address',
];
let pfTimer;
async function loadProfile() {
  const d = await api.storage.local.get('eula_alert_profile');
  const p = d.eula_alert_profile || {};
  PF.forEach((k) => {
    const el = document.getElementById('prof-' + k);
    if (el && p[k]) el.value = p[k];
  });
}
function collectProfile() {
  const p = {};
  PF.forEach((k) => {
    p[k] = document.getElementById('prof-' + k)?.value || '';
  });
  return p;
}
async function saveProfile() {
  await api.storage.local.set({ eula_alert_profile: collectProfile() });
  toast();
}
PF.forEach((k) => {
  const el = document.getElementById('prof-' + k);
  if (!el) return;
  el.addEventListener('input', () => {
    clearTimeout(pfTimer);
    pfTimer = setTimeout(saveProfile, 400);
  });
  el.addEventListener('blur', () => {
    clearTimeout(pfTimer);
    saveProfile();
  });
});

let stTimer;
async function loadSettings() {
  const d = await api.storage.local.get('eula_alert_settings');
  const s = d.eula_alert_settings || {};
  document.getElementById('set-autoScan').checked = s.autoScan !== false;
  updateAccessMode();
  document.getElementById('set-autoFill').checked = !!s.autoFill;
  document.getElementById('set-useAI').checked = s.useAI !== false;
  document.getElementById('set-showBadge').checked = s.showBadge !== false;
  document.getElementById('set-blockCookies').checked = !!s.blockCookies;
  document.getElementById('set-antiTracker').checked = !!s.antiTracker;
  document.getElementById('set-blockSocial').checked = !!s.blockSocial;
  document.getElementById('set-blockErrorTrackers').checked = !!s.blockErrorTrackers;
  document.getElementById('set-notifications').checked = s.notifications !== false;
  document.getElementById('set-riskLevel').value = s.riskLevel || 'all';

  document.getElementById('set-geminiApiKey').value = s.geminiApiKey || '';
  updateKeyDot();
  document.getElementById('set-safeBrowsing').checked = s.safeBrowsing !== false;
  document.getElementById('set-safeBrowsingApiKey').value = s.safeBrowsingApiKey || '';
  updateSbKeyDot();
  document.getElementById('set-virusTotal').checked = s.virusTotal !== false;
  document.getElementById('set-virusTotalApiKey').value = s.virusTotalApiKey || '';
  updateVtKeyDot();
  document.getElementById('set-phishTank').checked = s.phishTank !== false;
  document.getElementById('set-urlHaus').checked = s.urlHaus !== false;
  document.getElementById('set-checkDomainAge').checked = s.checkDomainAge !== false;
  document.getElementById('set-formSecurity').checked = s.formSecurity !== false;
  document.getElementById('set-blockCryptoMiners').checked = s.blockCryptoMiners !== false;
  document.getElementById('set-detectHiddenIframes').checked = s.detectHiddenIframes !== false;
  document.getElementById('set-detectObfuscatedJS').checked = s.detectObfuscatedJS !== false;
  document.getElementById('set-detectRedirects').checked = s.detectRedirects !== false;
  document.getElementById('set-detectExtInstall').checked = s.detectExtInstall !== false;
  const cp = s.cookiePolicy || {};
  document.getElementById('cp-functional').checked = cp.functional !== false;
  document.getElementById('cp-analytics').checked = !!cp.analytics;
  document.getElementById('cp-advertising').checked = !!cp.advertising;
  toggleCookieSection(!!s.blockCookies);
}

function collectSettings() {
  return {
    autoScan: document.getElementById('set-autoScan').checked,

    autoFill: document.getElementById('set-autoFill').checked,
    useAI: document.getElementById('set-useAI').checked,
    showBadge: document.getElementById('set-showBadge').checked,
    blockCookies: document.getElementById('set-blockCookies').checked,
    antiTracker: document.getElementById('set-antiTracker').checked,
    blockSocial: document.getElementById('set-blockSocial').checked,
    blockErrorTrackers: document.getElementById('set-blockErrorTrackers').checked,
    safeBrowsing: document.getElementById('set-safeBrowsing').checked,
    notifications: document.getElementById('set-notifications').checked,
    riskLevel: document.getElementById('set-riskLevel').value,
    geminiApiKey: (document.getElementById('set-geminiApiKey')?.value || '').trim(),
    safeBrowsingApiKey: (document.getElementById('set-safeBrowsingApiKey')?.value || '').trim(),
    virusTotal: document.getElementById('set-virusTotal').checked,
    virusTotalApiKey: (document.getElementById('set-virusTotalApiKey')?.value || '').trim(),
    phishTank: document.getElementById('set-phishTank').checked,
    urlHaus: document.getElementById('set-urlHaus').checked,
    checkDomainAge: document.getElementById('set-checkDomainAge').checked,
    formSecurity: document.getElementById('set-formSecurity').checked,
    blockCryptoMiners: document.getElementById('set-blockCryptoMiners').checked,
    detectHiddenIframes: document.getElementById('set-detectHiddenIframes').checked,
    detectObfuscatedJS: document.getElementById('set-detectObfuscatedJS').checked,
    detectRedirects: document.getElementById('set-detectRedirects').checked,
    detectExtInstall: document.getElementById('set-detectExtInstall').checked,
    cookiePolicy: {
      functional: document.getElementById('cp-functional').checked,
      analytics: document.getElementById('cp-analytics').checked,
      advertising: document.getElementById('cp-advertising').checked,
    },
    language: 'auto',
  };
}

async function saveSettings() {
  await api.storage.local.set({ eula_alert_settings: collectSettings() });
  toast();
}

function toggleCookieSection(on) {
  const s = document.getElementById('cookie-policy-section');
  s.style.opacity = on ? '1' : '.4';
  s.style.pointerEvents = on ? 'auto' : 'none';
}

document.querySelectorAll('.card input[type=checkbox]').forEach((cb) =>
  cb.addEventListener('change', () => {
    if (cb.id === 'set-blockCookies') toggleCookieSection(cb.checked);
    saveSettings();
  })
);
document.getElementById('set-riskLevel')?.addEventListener('change', saveSettings);

document.getElementById('set-geminiApiKey')?.addEventListener('input', () => {
  updateKeyDot();
  clearTimeout(stTimer);
  stTimer = setTimeout(saveSettings, 500);
});
document.getElementById('set-geminiApiKey')?.addEventListener('blur', () => {
  clearTimeout(stTimer);
  saveSettings();
});
document.getElementById('toggle-key-vis').addEventListener('click', () => {
  const i = document.getElementById('set-geminiApiKey');
  i.type = i.type === 'password' ? 'text' : 'password';
});
function updateKeyDot() {
  const v = (document.getElementById('set-geminiApiKey')?.value || '').trim();
  const d = document.getElementById('api-dot');
  d.className = 'api-dot ' + (v.length > 10 ? 'api-ok' : 'api-no');
}
function updateSbKeyDot() {
  const v = (document.getElementById('set-safeBrowsingApiKey')?.value || '').trim();
  const d = document.getElementById('sb-api-dot');
  if (d) d.className = 'api-dot ' + (v.length > 10 ? 'api-ok' : 'api-no');
}
function updateVtKeyDot() {
  const v = (document.getElementById('set-virusTotalApiKey')?.value || '').trim();
  const d = document.getElementById('vt-api-dot');
  if (d) d.className = 'api-dot ' + (v.length > 10 ? 'api-ok' : 'api-no');
}
document.getElementById('set-safeBrowsingApiKey')?.addEventListener('input', () => {
  updateSbKeyDot();
  clearTimeout(stTimer);
  stTimer = setTimeout(saveSettings, 500);
});
document.getElementById('set-safeBrowsingApiKey')?.addEventListener('blur', () => {
  clearTimeout(stTimer);
  saveSettings();
});
document.getElementById('toggle-sb-key-vis')?.addEventListener('click', () => {
  const i = document.getElementById('set-safeBrowsingApiKey');
  i.type = i.type === 'password' ? 'text' : 'password';
});
document.getElementById('set-virusTotal')?.addEventListener('change', () => {
  clearTimeout(stTimer);
  saveSettings();
});
document.getElementById('set-virusTotalApiKey')?.addEventListener('input', () => {
  updateVtKeyDot();
  clearTimeout(stTimer);
  stTimer = setTimeout(saveSettings, 500);
});
document.getElementById('set-virusTotalApiKey')?.addEventListener('blur', () => {
  clearTimeout(stTimer);
  saveSettings();
});
document.getElementById('toggle-vt-key-vis')?.addEventListener('click', () => {
  const i = document.getElementById('set-virusTotalApiKey');
  i.type = i.type === 'password' ? 'text' : 'password';
});

async function updateAccessMode() {
  const hasAll = await api.permissions.contains({ origins: ['<all_urls>'] }).catch(() => false);
  const box = document.getElementById('access-mode-box');
  const title = document.getElementById('access-mode-title');
  const desc = document.getElementById('access-mode-desc');
  const btn = document.getElementById('btn-toggle-access');
  if (!box) return;
  if (hasAll) {
    box.style.background = '#e8f5e9';
    box.style.border = '1px solid #a5d6a7';
    title.textContent = 'Полный режим';
    desc.textContent = 'Все функции работают автоматически на каждом сайте';
    btn.textContent = 'Отключить';
    btn.style.background = '#e0e0e0';
    btn.style.color = '#333';
    btn.onclick = async () => {
      await api.permissions.remove({ origins: ['<all_urls>'] }).catch(() => {});
      updateAccessMode();
    };
  } else {
    box.style.background = '#fff8e1';
    box.style.border = '1px solid #ffe082';
    title.textContent = 'Базовый режим';
    desc.textContent =
      'Cookie-блокер и EULA-анализ работают при клике на иконку. Проверки безопасности (PhishTank, URLhaus, WHOIS) - автоматически';
    btn.textContent = 'Включить полный';
    btn.style.background = 'linear-gradient(135deg,#2e7d32,#66bb6a)';
    btn.style.color = '#fff';
    btn.onclick = async () => {
      try {
        await api.permissions.request({ origins: ['<all_urls>'] });
      } catch {}
      updateAccessMode();
    };
  }
}

async function loadWhitelist() {
  const d = await api.storage.local.get('eula_alert_whitelist');
  renderWL(d.eula_alert_whitelist || []);
}
function renderWL(list) {
  const c = document.getElementById('whitelist-items');
  if (!list.length) {
    c.innerHTML = '';
    return;
  }
  c.innerHTML = list
    .map(
      (d, i) =>
        `<div class="wl-item"><span>${escHtml(d)}</span><button class="wl-rm" data-i="${i}"></button></div>`
    )
    .join('');
  c.querySelectorAll('.wl-rm').forEach((b) =>
    b.addEventListener('click', async () => {
      const d = await api.storage.local.get('eula_alert_whitelist');
      const w = d.eula_alert_whitelist || [];
      w.splice(parseInt(b.dataset.i), 1);
      await api.storage.local.set({ eula_alert_whitelist: w });
      renderWL(w);
      toast();
    })
  );
}
document.getElementById('whitelist-add')?.addEventListener('click', async () => {
  const inp = document.getElementById('whitelist-input');
  let domain = (inp?.value || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^www\./, '');
  if (!domain || domain.length < 3) return;
  const d = await api.storage.local.get('eula_alert_whitelist');
  const w = d.eula_alert_whitelist || [];
  if (!w.includes(domain)) {
    w.push(domain);
    await api.storage.local.set({ eula_alert_whitelist: w });
  }
  renderWL(w);
  inp.value = '';
  toast();
});
document.getElementById('whitelist-input')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('whitelist-add')?.click();
});

async function loadHistory() {
  const d = await api.storage.local.get('eula_alert_history');
  const h = d.eula_alert_history || [];
  const c = document.getElementById('history-list');
  if (!h.length) {
    c.innerHTML = `<div class="hist-empty">${t('historyEmpty', 'Пока пусто')}</div>`;
    return;
  }
  c.innerHTML = h
    .slice(0, 50)
    .map((i) => {
      const dt = new Date(i.date).toLocaleDateString(undefined, {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
      const bg = i.score <= 20 ? '#16a34a' : i.score <= 50 ? '#f59e0b' : '#ef4444';
      return `<div class="hist-item"><div class="hist-left"><div class="hist-url" title="${escHtml(i.url)}">${escHtml(i.title || i.url)}</div><div class="hist-date">${dt} - ${i.findings} ${t('findings', 'находок')}</div></div><span class="hist-score" style="background:${bg}">${i.score}</span></div>`;
    })
    .join('');
}
document.getElementById('history-clear')?.addEventListener('click', async () => {
  await api.storage.local.set({ eula_alert_history: [] });
  loadHistory();
  toast();
});

window.addEventListener('beforeunload', () => {
  api.storage.local.set({
    eula_alert_profile: collectProfile(),
    eula_alert_settings: collectSettings(),
  });
});
loadProfile();
loadSettings();
loadWhitelist();
loadHistory();
