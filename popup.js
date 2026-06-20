const api = typeof browser !== 'undefined' ? browser : chrome;
const ALL_SCRIPTS = [
  'storage.js',
  'form_helper.js',
  'tos_analyzer.js',
  'cookie_blocker.js',
  'content.js',
];

if (api.runtime.getManifest().manifest_version === 2 && !api.scripting) {
  api.scripting = {
    async executeScript(opts) {
      const tabId = opts.target.tabId;
      if (opts.func) {
        const argsList = opts.args || [];
        const code =
          '(' +
          opts.func.toString() +
          ')(' +
          argsList.map((a) => JSON.stringify(a)).join(',') +
          ')';
        try {
          const r = await api.tabs.executeScript(tabId, { code, runAt: 'document_idle' });
          return (r || []).map((v) => ({ result: v }));
        } catch {
          return [{ result: undefined }];
        }
      }
      if (opts.files) {
        for (const file of opts.files)
          await api.tabs.executeScript(tabId, { file, runAt: 'document_idle' });
        return [{ result: true }];
      }
      return [{ result: undefined }];
    },
    async insertCSS(opts) {
      if (opts.files)
        for (const f of opts.files) await api.tabs.insertCSS(opts.target.tabId, { file: f });
    },
  };
}

(async () => {
  const d = await api.storage.local.get('eula_alert_settings');
  const s = d.eula_alert_settings || {};
  document.getElementById('t-autoScan').checked = s.autoScan !== false;
  document.getElementById('t-useAI').checked = s.useAI !== false;
})();

async function saveSetting(key, val) {
  const d = await api.storage.local.get('eula_alert_settings');
  const s = d.eula_alert_settings || {};
  s[key] = val;
  await api.storage.local.set({ eula_alert_settings: s });
}
document
  .getElementById('t-autoScan')
  ?.addEventListener('change', (e) => saveSetting('autoScan', e.target.checked));
document
  .getElementById('t-useAI')
  ?.addEventListener('change', (e) => saveSetting('useAI', e.target.checked));

async function runAction(actionName) {
  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  try {
    await api.scripting.executeScript({ target: { tabId: tab.id }, files: ALL_SCRIPTS });

    await api.scripting.executeScript({
      target: { tabId: tab.id },
      func: (action) => {
        window.__eula_alert_actions?.[action]?.();
      },
      args: [actionName],
    });
  } catch (e) {
    console.warn('EulaAlert: action error', e.message);
  }
}

document.getElementById('btn-autofill')?.addEventListener('click', () => runAction('run_autofill'));
document.getElementById('btn-scan')?.addEventListener('click', () => runAction('toggle_panel'));
document
  .getElementById('btn-cookies')
  ?.addEventListener('click', () => runAction('run_cookie_block'));
document
  .getElementById('btn-social')
  ?.addEventListener('click', () => runAction('run_social_block'));

async function updateAccessBanner() {
  const hasAll = await api.permissions.contains({ origins: ['<all_urls>'] }).catch(() => false);
  const banner = document.getElementById('access-banner');
  const text = document.getElementById('access-text');
  const btn = document.getElementById('access-btn');
  if (!banner) return;
  if (hasAll) {
    banner.style.background = '#e8f5e9';
    banner.style.border = '1px solid #a5d6a7';
    text.textContent = 'Полный режим - всё автоматически';
    btn.textContent = 'Отключить';
    btn.style.background = '#e0e0e0';
    btn.style.color = '#333';
    btn.onclick = async () => {
      await api.permissions.remove({ origins: ['<all_urls>'] }).catch(() => {});
      updateAccessBanner();
    };
  } else {
    banner.style.background = '#fff8e1';
    banner.style.border = '1px solid #ffe082';
    text.textContent = 'Базовый - только при клике';
    btn.textContent = 'Полный';
    btn.style.background = '#2e7d32';
    btn.style.color = '#fff';
    btn.onclick = async () => {
      try {
        const resp = await api.runtime.sendMessage({ type: 'request_all_urls' });
        if (resp?.granted) updateAccessBanner();
      } catch {
        try {
          await api.permissions.request({ origins: ['<all_urls>'] });
        } catch {}
        updateAccessBanner();
      }
    };
  }
}
updateAccessBanner();

document.getElementById('open-options')?.addEventListener('click', (e) => {
  e.preventDefault();
  api.runtime.openOptionsPage();
});

async function loadStats() {
  const d = await api.storage.local.get('eula_alert_stats');
  const s = d.eula_alert_stats || { trackers: 0, threats: 0, cookies: 0, scans: 0 };

  function fmt(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return String(n);
  }

  const el = (id) => document.getElementById(id);
  if (el('stat-trackers')) el('stat-trackers').textContent = fmt(s.trackers || 0);
  if (el('stat-cookies')) el('stat-cookies').textContent = fmt(s.cookies || 0);
  if (el('stat-threats')) el('stat-threats').textContent = fmt(s.threats || 0);
  if (el('stat-scans')) el('stat-scans').textContent = fmt(s.scans || 0);
}
loadStats();

api.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.eula_alert_stats) loadStats();
});

const AD_URL = 'https://pastebin.com/raw/KbBeZwPE';
const AD_OPEN_KEY = 'eula_ad_open';

function toggleAd() {
  const box = document.getElementById('ad-box');
  const icon = document.getElementById('ad-icon');
  const open = box.classList.toggle('open');
  icon.classList.toggle('open', open);

  try {
    api.storage.local.set({ [AD_OPEN_KEY]: open });
  } catch {}
}

async function loadAd() {
  const inner = document.getElementById('ad-inner');
  if (!inner) return;
  try {
    const resp = await fetch(AD_URL, { cache: 'no-store' });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const text = (await resp.text()).trim();

    const safe = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>');
    inner.innerHTML = safe || '<span class="ad-err">Нет сообщения</span>';
  } catch {
    inner.innerHTML = '<span class="ad-err">Не удалось загрузить</span>';
  }
}

document.getElementById('ad-toggle')?.addEventListener('click', toggleAd);

document.getElementById('ad-inner')?.addEventListener('click', (e) => {
  if (e.target.closest('a')) return;
  toggleAd();
});

(async () => {
  const d = await api.storage.local.get(AD_OPEN_KEY);

  const isOpen = d[AD_OPEN_KEY] !== false;
  if (isOpen) {
    document.getElementById('ad-box')?.classList.add('open');
    document.getElementById('ad-icon')?.classList.add('open');
  }
  await loadAd();
})();

let _mtPollTimer = null;
let _mtPollCount = 0;
let _mtCurrentEmail = null;
const MT_POLL_INTERVAL = 5000;
const MT_MAX_POLLS = 72;

function mtSetStatus(text, color = '#6b7280') {
  const el = document.getElementById('tempemail-status');
  if (el) {
    el.textContent = text;
    el.style.color = color;
  }
}

function mtShowCode(code) {
  const box = document.getElementById('tempemail-code-box');
  const val = document.getElementById('tempemail-code-value');
  if (box) box.style.display = 'block';
  if (val) val.textContent = code;
}

function mtStopPolling() {
  if (_mtPollTimer) {
    clearTimeout(_mtPollTimer);
    _mtPollTimer = null;
  }
}

async function mtStartPolling(tabId) {
  mtStopPolling();
  _mtPollCount = 0;

  async function tick() {
    if (_mtPollCount >= MT_MAX_POLLS) {
      mtSetStatus('Время вышло — письмо не пришло', '#dc2626');
      return;
    }
    _mtPollCount++;
    const elapsed = Math.round((_mtPollCount * MT_POLL_INTERVAL) / 1000);
    mtSetStatus(`Жду письмо… ${elapsed}с`, '#d97706');

    let resp;
    try {
      resp = await api.runtime.sendMessage({ type: 'mailtm_poll' });
    } catch {
      resp = { error: 'runtime error' };
    }

    if (resp?.error) {
      mtSetStatus('Ошибка: ' + resp.error, '#dc2626');
      return;
    }

    if (resp?.codes?.length) {
      const { code, subject, from } = resp.codes[0];
      mtShowCode(code);
      mtSetStatus(`Письмо от: ${from || '?'} | "${subject || ''}"`, '#16a34a');
      mtStopPolling();

      try {
        await api.scripting.executeScript({
          target: { tabId },
          func: (c) => window.FormHelper?.fillCode(c),
          args: [code],
        });
      } catch {}
      return;
    }

    _mtPollTimer = setTimeout(tick, MT_POLL_INTERVAL);
  }

  tick();
}

async function mtRestoreSession() {
  let resp;
  try {
    resp = await api.runtime.sendMessage({ type: 'mailtm_status' });
  } catch {
    return;
  }
  if (!resp?.active) return;
  _mtCurrentEmail = resp.address;
  const panel = document.getElementById('tempemail-panel');
  const addr = document.getElementById('tempemail-address');
  if (panel) panel.style.display = 'block';
  if (addr) addr.textContent = resp.address;
  const btn = document.getElementById('btn-tempemail');
  if (btn) btn.textContent = 'Обновить';
  mtSetStatus('Нажмите «Проверить» для получения кода', '#6b7280');
}

document.getElementById('btn-tempemail')?.addEventListener('click', async () => {
  const btn = document.getElementById('btn-tempemail');
  btn.disabled = true;
  btn.textContent = 'Создаю…';

  const panel = document.getElementById('tempemail-panel');
  if (panel) panel.style.display = 'block';

  try {
    const [tab] = await api.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('нет активной вкладки');

    await api.scripting.executeScript({ target: { tabId: tab.id }, files: ALL_SCRIPTS });

    let resp;
    try {
      resp = await api.runtime.sendMessage({ type: 'mailtm_create' });
    } catch (e) {
      throw new Error('runtime: ' + e.message);
    }
    if (resp?.error) throw new Error(resp.error);

    _mtCurrentEmail = resp.address;
    const addr = document.getElementById('tempemail-address');
    if (addr) addr.textContent = resp.address;

    const codeBox = document.getElementById('tempemail-code-box');
    if (codeBox) codeBox.style.display = 'none';

    try {
      await api.scripting.executeScript({
        target: { tabId: tab.id },
        func: (email) => window.FormHelper?.fillTempEmail(email),
        args: [resp.address],
      });
    } catch {}

    await mtStartPolling(tab.id);

    btn.textContent = 'Обновить';
    btn.disabled = false;
  } catch (e) {
    mtSetStatus(e.message, '#dc2626');
    btn.textContent = 'Временный email';
    btn.disabled = false;
  }
});

document.getElementById('tempemail-poll')?.addEventListener('click', async () => {
  const btn = document.getElementById('tempemail-poll');
  btn.disabled = true;
  btn.textContent = '…';
  try {
    const [tab] = await api.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await api.scripting.executeScript({ target: { tabId: tab.id }, files: ALL_SCRIPTS });
      await mtStartPolling(tab.id);
    }
  } finally {
    setTimeout(() => {
      btn.disabled = false;
      btn.textContent = 'Проверить';
    }, 1500);
  }
});

document.getElementById('tempemail-copy')?.addEventListener('click', () => {
  if (_mtCurrentEmail) navigator.clipboard.writeText(_mtCurrentEmail).catch(() => {});
});

document.getElementById('tempemail-clear')?.addEventListener('click', async () => {
  mtStopPolling();
  try {
    await api.runtime.sendMessage({ type: 'mailtm_clear' });
  } catch {}
  _mtCurrentEmail = null;
  const panel = document.getElementById('tempemail-panel');
  if (panel) panel.style.display = 'none';
  const btn = document.getElementById('btn-tempemail');
  if (btn) {
    btn.textContent = 'Временный email';
    btn.disabled = false;
  }
});

mtRestoreSession();

let _reportScreenshotDataUrl = null;

document.getElementById('btn-report')?.addEventListener('click', () => {
  const panel = document.getElementById('report-panel');
  if (!panel) return;
  const visible = panel.style.display !== 'none';
  panel.style.display = visible ? 'none' : 'block';
});

document.getElementById('report-screenshot-btn')?.addEventListener('click', async () => {
  const btn = document.getElementById('report-screenshot-btn');
  btn.disabled = true;
  btn.textContent = '...';
  try {
    const dataUrl = await api.tabs.captureVisibleTab(null, { format: 'png', quality: 80 });
    _reportScreenshotDataUrl = dataUrl;
    const img = document.getElementById('report-screenshot');
    img.src = dataUrl;
    document.getElementById('report-preview').style.display = 'block';
    btn.textContent = 'Готово';
  } catch (e) {
    btn.textContent = 'Ошибка';
    console.warn('Screenshot failed:', e.message);
  }
  setTimeout(() => {
    btn.disabled = false;
    btn.textContent = 'Скриншот';
  }, 1500);
});

document.getElementById('report-send-btn')?.addEventListener('click', async () => {
  const btn = document.getElementById('report-send-btn');
  const status = document.getElementById('report-status');
  const text = document.getElementById('report-text')?.value?.trim() || '';

  if (!text && !_reportScreenshotDataUrl) {
    status.style.display = 'block';
    status.style.color = '#dc2626';
    status.textContent = 'Опишите проблему или сделайте скриншот';
    return;
  }

  btn.disabled = true;
  btn.textContent = '...';

  try {
    const [tab] = await api.tabs.query({ active: true, currentWindow: true });
    const manifest = api.runtime.getManifest();
    const ua = navigator.userAgent;
    let browserName = 'Unknown';
    if (ua.includes('YaBrowser')) browserName = 'Yandex';
    else if (ua.includes('Comet')) browserName = 'Comet';
    else if (ua.includes('Firefox')) browserName = 'Firefox';
    else if (ua.includes('Edg/')) browserName = 'Edge';
    else if (ua.includes('Chrome')) browserName = 'Chrome';

    const context = {
      extensionVersion: manifest.version,
      browser: browserName,
      timestamp: new Date().toISOString(),
    };

    if (typeof Sentry !== 'undefined') {
      Sentry.withScope((scope) => {
        scope.setLevel('info');
        scope.setTag('browser', browserName);
        scope.setTag('extension_version', manifest.version);
        scope.setTag('report_type', 'user_bug_report');
        scope.setContext('report', context);
        if (_reportScreenshotDataUrl) {
          scope.addAttachment({
            filename: 'screenshot.png',
            data: _reportScreenshotDataUrl.split(',')[1],
            contentType: 'image/png',
          });
        }
        Sentry.captureMessage('[Жалоба] ' + (text || 'Скриншот приложен'), 'info');
      });
    }

    status.style.display = 'block';
    status.style.color = '#16a34a';
    status.textContent = 'Отчёт отправлен. Спасибо!';
    document.getElementById('report-text').value = '';
    _reportScreenshotDataUrl = null;
    document.getElementById('report-preview').style.display = 'none';
  } catch (e) {
    status.style.display = 'block';
    status.style.color = '#dc2626';
    status.textContent = 'Ошибка отправки: ' + e.message;
  }

  setTimeout(() => {
    btn.disabled = false;
    btn.textContent = 'Отправить';
    status.style.display = 'none';
  }, 3000);
});
