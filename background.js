
const api = typeof browser !== 'undefined' ? browser : chrome;

const IS_MV2 = (api.runtime.getManifest().manifest_version === 2);

if (IS_MV2 && !api.scripting) {
  
  const _regScripts = new Map();
  api.scripting = {
    async executeScript(opts) {
      const tabId = opts.target.tabId;
      if (opts.func) {
        const argsList = opts.args || [];
        const code = '(' + opts.func.toString() + ')(' + argsList.map(a => JSON.stringify(a)).join(',') + ')';
        try {
          const results = await api.tabs.executeScript(tabId, { code, runAt: 'document_idle' });
          return (results || []).map(r => ({ result: r }));
        } catch { return [{ result: undefined }]; }
      }
      if (opts.files) {
        for (const file of opts.files) {
          await api.tabs.executeScript(tabId, { file, runAt: 'document_idle' });
        }
        return [{ result: true }];
      }
      return [{ result: undefined }];
    },
    async insertCSS(opts) {
      const tabId = opts.target.tabId;
      if (opts.files) {
        for (const f of opts.files) { await api.tabs.insertCSS(tabId, { file: f }); }
      }
    },
    async registerContentScripts(scripts) {
      for (const s of scripts) _regScripts.set(s.id, s);
    },
    async updateContentScripts(scripts) {
      for (const s of scripts) _regScripts.set(s.id, s);
    },
    async unregisterContentScripts(filter) {
      if (filter?.ids) filter.ids.forEach(id => _regScripts.delete(id));
    },
    async getRegisteredContentScripts(filter) {
      if (filter?.ids) return filter.ids.map(id => _regScripts.get(id)).filter(Boolean);
      return [..._regScripts.values()];
    }
  };
}

const STATS_KEY = 'eula_alert_stats';
async function incrementStats(delta) {
  const d = await api.storage.local.get(STATS_KEY);
  const s = d[STATS_KEY] || { trackers: 0, threats: 0, cookies: 0, scans: 0, sitesChecked: 0 };
  for (const [k, v] of Object.entries(delta)) {
    if (typeof s[k] === 'number') s[k] += v;
    else s[k] = v;
  }
  await api.storage.local.set({ [STATS_KEY]: s });
}

const FETCH_TIMEOUT = 15000;
const AI_TIMEOUT    = 25000;
const CONTENT_SCRIPTS = ['storage.js','form_helper.js','tos_analyzer.js','cookie_blocker.js','content.js'];
const CONTENT_CSS = ['styles/content.css'];

const SEARCH_ENGINE_DOMAINS = [
  'google.com','google.ru','google.co.uk','google.de','google.fr',
  'www.google.com','www.google.ru',
  'bing.com','www.bing.com',
  'yandex.ru','yandex.com','yandex.by','yandex.kz','yandex.ua',
  'ya.ru','www.ya.ru',
  'duckduckgo.com','www.duckduckgo.com',
  'search.yahoo.com','yahoo.com',
  'baidu.com','www.baidu.com',
  'startpage.com','www.startpage.com',
  'ecosia.org','www.ecosia.org',
  'mail.google.com','docs.google.com','drive.google.com',
  'maps.google.com','translate.google.com',
  'youtube.com','www.youtube.com'
];

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
  ]);
}

async function getApiKey() {
  const d = await api.storage.local.get('eula_alert_settings');
  return (d.eula_alert_settings || {}).geminiApiKey || '';
}

async function getWhitelist() {
  const d = await api.storage.local.get('eula_alert_whitelist');
  return d.eula_alert_whitelist || [];
}

function isSearchEngine(hostname) {
  const h = hostname.toLowerCase().replace(/^www\./, '');
  return SEARCH_ENGINE_DOMAINS.some(d => {
    const dd = d.replace(/^www\./, '');
    return h === dd || h.endsWith('.' + dd);
  });
}

async function shouldSkipUrl(url) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (isSearchEngine(hostname)) return true;
    const whitelist = await getWhitelist();
    for (const entry of whitelist) {
      const pattern = entry.toLowerCase().replace(/^www\./, '');
      const h = hostname.replace(/^www\./, '');
      if (h === pattern || h.endsWith('.' + pattern)) return true;
    }
    return false;
  } catch { return false; }
}

async function fetchDocumentText(url) {
  try {
    const resp = await withTimeout(fetch(url, { credentials: 'omit', redirect: 'follow' }), FETCH_TIMEOUT);
    if (!resp.ok) return { error: 'HTTP ' + resp.status };
    const html = await withTimeout(resp.text(), FETCH_TIMEOUT);
    
    let text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
      .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ').trim();
    return { text };
  } catch (e) {
    return { error: e.message };
  }
}

async function analyzeWithGemini(text, docType, retryCount = 0) {
  const MAX_RETRIES = 2;
  const key = await getApiKey();
  if (!key) return { error: 'no_api_key' };
  const truncated = text.slice(0, 30000);
  const prompt = `Ты - эксперт по анализу пользовательских соглашений (EULA/ToS/Privacy Policy).
Проанализируй следующий документ (${docType === 'privacy' ? 'Политика конфиденциальности' : 'Пользовательское соглашение'}) и выдели ключевые риски для пользователя.

Отвечай СТРОГО в формате JSON:
{"summary":"краткое резюме (2-3 предложения)","risks":[{"category":"название","severity":"critical|high|medium|low","description":"описание","excerpt":"цитата"}],"recommendation":"общая рекомендация"}

Документ:
${truncated}`;
  try {
    const resp = await withTimeout(
      fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 2048, responseMimeType: 'application/json' }
        })
      }),
      AI_TIMEOUT
    );
    if (!resp.ok) {
      const status = resp.status;
      if (status === 400 || status === 403) return { error: 'invalid_api_key' };
      if (status === 429) {
        if (retryCount < MAX_RETRIES) {
          const delay = (retryCount + 1) * 5000;
          await new Promise(r => setTimeout(r, delay));
          return analyzeWithGemini(text, docType, retryCount + 1);
        }
        try {
          api.notifications.create('eula_alert_ratelimit', {
            type: 'basic', iconUrl: api.runtime.getURL('icons/icon128.png'),
            title: 'MiniShield - лимит API',
            message: 'Достигнут лимит запросов Gemini API. Подождите минуту.',
            priority: 1
          });
        } catch {}
        return { error: 'rate_limit' };
      }
      return { error: 'Gemini HTTP ' + status };
    }
    const data = await resp.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) return { error: 'empty response' };
    return { result: JSON.parse(raw) };
  } catch (e) {
    return { error: e.message };
  }
}

async function injectContentScripts(tabId) {
  try {
    const results = await api.scripting.executeScript({ target: { tabId }, func: () => window.__eula_alert_loaded });
    if (results?.[0]?.result) return;
  } catch {}
  try {
    await api.scripting.insertCSS({ target: { tabId }, files: CONTENT_CSS });
    await api.scripting.executeScript({ target: { tabId }, files: CONTENT_SCRIPTS });
  } catch (e) {
    console.warn('EulaAlert: inject failed', e.message);
  }
}

async function updateAutoScan() {
  const hasPermission = await api.permissions.contains({ origins: ['<all_urls>'] }).catch(() => false);

  let alreadyRegistered = false;
  try {
    const existing = await api.scripting.getRegisteredContentScripts({ ids: ['eula_alert_autoscan'] });
    alreadyRegistered = existing.length > 0;
  } catch {}

  if (hasPermission) {
    const scriptDef = {
      id: 'eula_alert_autoscan',
      matches: ['<all_urls>'],
      js: CONTENT_SCRIPTS,
      css: CONTENT_CSS,
      runAt: 'document_idle'
    };
    try {
      if (alreadyRegistered) {
        
        await api.scripting.updateContentScripts([scriptDef]);
      } else {
        await api.scripting.registerContentScripts([scriptDef]);
      }
    } catch (e) {
      
      try { await api.scripting.unregisterContentScripts({ ids: ['eula_alert_autoscan'] }); } catch {}
      try { await api.scripting.registerContentScripts([scriptDef]); } catch {}
    }
  } else if (alreadyRegistered) {
    try { await api.scripting.unregisterContentScripts({ ids: ['eula_alert_autoscan'] }); } catch {}
  }

  await api.storage.local.set({ eula_alert_full_access: hasPermission });
}

api.permissions?.onAdded?.addListener(() => updateAutoScan());
api.permissions?.onRemoved?.addListener(() => updateAutoScan());

async function getSafeBrowsingKey() {
  const d = await api.storage.local.get('eula_alert_settings');
  return (d.eula_alert_settings || {}).safeBrowsingApiKey || '';
}

async function checkSafeBrowsingV4(url, key) {
  try {
    const body = {
      client: { clientId: 'eula-alert-extension', clientVersion: '3.0.0' },
      threatInfo: {
        threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION', 'THREAT_TYPE_UNSPECIFIED'],
        platformTypes: ['ANY_PLATFORM'],
        threatEntryTypes: ['URL'],
        threatEntries: [{ url }]
      }
    };
    const resp = await withTimeout(
      fetch(`https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }),
      FETCH_TIMEOUT
    );
    if (!resp.ok) {
      if (resp.status === 400 || resp.status === 403) return { safe: true, error: 'invalid_key' };
      return { safe: true, error: 'http_' + resp.status };
    }
    const data = await resp.json();
    if (data.matches && data.matches.length > 0) {
      const threats = data.matches.map(m => ({
        type: m.threatType,
        platform: m.platformType,
        url: m.threat?.url
      }));
      return { safe: false, threats };
    }
    return { safe: true };
  } catch (e) {
    return { safe: true, error: e.message };
  }
}

const THREAT_LABELS = {
  'MALWARE': '[!] Вредоносное ПО (Malware)',
  'SOCIAL_ENGINEERING': '[!] Фишинг (Social Engineering)',
  'UNWANTED_SOFTWARE': '[!] Нежелательное ПО',
  'POTENTIALLY_HARMFUL_APPLICATION': '[!] Потенциально опасное приложение',
  'THREAT_TYPE_UNSPECIFIED': '[!] Угроза безопасности'
};

async function checkDomainAge(hostname) {
  try {
    const parts = hostname.replace(/^www\./, '').split('.');
    const domain = parts.length > 2 ? parts.slice(-2).join('.') : hostname.replace(/^www\./, '');
    const resp = await fetch(`https://rdap.org/domain/${domain}`, {
      signal: AbortSignal.timeout(10000),
      headers: { 'Accept': 'application/rdap+json' }
    });
    if (!resp.ok) return { safe: true, source: 'whois' };
    const data = await resp.json();
    const regEvent = (data.events || []).find(e => e.eventAction === 'registration');
    if (!regEvent || !regEvent.eventDate) return { safe: true, source: 'whois' };
    const regDate = new Date(regEvent.eventDate);
    const ageDays = Math.floor((Date.now() - regDate.getTime()) / 86400000);
    if (ageDays < 30) {
      return { safe: false, source: 'whois', ageDays, regDate: regEvent.eventDate };
    }
    return { safe: true, source: 'whois', ageDays };
  } catch { return { safe: true, source: 'whois' }; }
}

async function checkVirusTotal(url, vtKey) {
  if (!vtKey) return { safe: true, source: 'virustotal' };
  try {
    
    const canonicalUrl = url.endsWith('/') ? url : url + '/';
    const urlId = btoa(canonicalUrl).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
    const resp = await fetch(`https://www.virustotal.com/api/v3/urls/${urlId}`, {
      headers: { 'x-apikey': vtKey },
      signal: AbortSignal.timeout(10000)
    });
    if (resp.status === 404) {
      
      const scanResp = await fetch('https://www.virustotal.com/api/v3/urls', {
        method: 'POST',
        headers: { 'x-apikey': vtKey, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'url=' + encodeURIComponent(url),
        signal: AbortSignal.timeout(10000)
      });
      if (!scanResp.ok) return { safe: true, source: 'virustotal' };
      return { safe: true, pending: true, source: 'virustotal' };
    }
    if (!resp.ok) return { safe: true, source: 'virustotal' };
    const data = await resp.json();
    const stats = data?.data?.attributes?.last_analysis_stats || {};
    const malicious = (stats.malicious || 0) + (stats.suspicious || 0);
    if (malicious >= 2) {
      return { safe: false, source: 'virustotal', malicious, total: (stats.harmless||0)+(stats.malicious||0)+(stats.suspicious||0)+(stats.undetected||0) };
    }
    return { safe: true, source: 'virustotal' };
  } catch { return { safe: true, source: 'virustotal' }; }
}

async function checkPhishTank(url) {
  try {
    const body = new URLSearchParams({ url, format: 'json', app_key: '' });
    const resp = await fetch('https://checkurl.phishtank.com/checkurl/', {
      method: 'POST',
      body: body.toString(),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal: AbortSignal.timeout(10000)
    });
    if (!resp.ok) return { safe: true, source: 'phishtank' };
    const text = await resp.text();
    try {
      const data = JSON.parse(text);
      if (data?.results?.in_database && data.results.valid) {
        return { safe: false, source: 'phishtank', phish: true };
      }
    } catch {
      
      const resultsMatch = text.match(/<results>[\s\S]*?<\/results>/i);
      const resultsBlock = resultsMatch ? resultsMatch[0] : text;
      if (resultsBlock.includes('<valid>true</valid>') && resultsBlock.includes('<in_database>true</in_database>')) {
        return { safe: false, source: 'phishtank', phish: true };
      }
    }
    return { safe: true, source: 'phishtank' };
  } catch { return { safe: true, source: 'phishtank' }; }
}

async function checkURLhaus(url) {
  try {
    const resp = await fetch('https://urlhaus-api.abuse.ch/v1/url/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'url=' + encodeURIComponent(url),
      signal: AbortSignal.timeout(10000)
    });
    if (!resp.ok) return { safe: true, source: 'urlhaus' };
    const data = await resp.json();
    if (data?.query_status === 'ok' && data.url_status === 'online') {
      const tags = (data.tags || []).join(', ');
      return { safe: false, source: 'urlhaus', malwareType: data.threat || 'malware', tags };
    }
    return { safe: true, source: 'urlhaus' };
  } catch { return { safe: true, source: 'urlhaus' }; }
}

const sbCache = new Map();
const _notifiedTabs = new Map();
const SB_CACHE_TTL = 5 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [key, val] of sbCache) {
    if (now - val.time > SB_CACHE_TTL) sbCache.delete(key);
  }
}, 60000);

async function injectAllScripts(tabId, url) {
  try {
    if (!url || url.startsWith('chrome://') || url.startsWith('edge://') || url.startsWith('browser://') || url.startsWith('about:') || url.startsWith('chrome-extension://') || url.startsWith('moz-extension://')) return;
    
    const hasPermission = await api.permissions.contains({ origins: ['<all_urls>'] }).catch(() => false);
    if (!hasPermission) return;
    const already = await api.scripting.executeScript({ target: { tabId }, func: () => !!window.__eula_alert_loaded }).catch(() => null);
    if (already?.[0]?.result) return;
    await api.scripting.insertCSS({ target: { tabId }, files: CONTENT_CSS }).catch(() => {});
    await api.scripting.executeScript({ target: { tabId }, files: CONTENT_SCRIPTS }).catch(() => {});
  } catch {}
}

async function onTabNavigated(tabId, url) {
  if (!url || url.startsWith('chrome://') || url.startsWith('edge://') || url.startsWith('browser://') || url.startsWith('about:') || url.startsWith('moz-extension://') || url.startsWith('chrome-extension://')) return;
  const d = await api.storage.local.get('eula_alert_settings');
  const s = d.eula_alert_settings || {};

  const cached = sbCache.get(url);
  if (cached && Date.now() - cached.time < SB_CACHE_TTL) {
    if (cached.safe) return;
  }

  const sbKey = s.safeBrowsingApiKey || '';
  const vtKey = s.virusTotalApiKey || '';
  const hostname = new URL(url).hostname;
  const checks = [];
  if (s.safeBrowsing !== false && sbKey) checks.push(checkSafeBrowsingV4(url, sbKey));
  if (s.virusTotal !== false && vtKey) checks.push(checkVirusTotal(url, vtKey));
  if (s.phishTank !== false) checks.push(checkPhishTank(url));
  if (s.urlHaus !== false) checks.push(checkURLhaus(url));
  if (s.checkDomainAge !== false) checks.push(checkDomainAge(hostname));
  if (checks.length === 0) return;

  const results = await Promise.allSettled(checks);
  const threats = [];
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    const v = r.value;
    if (!v.safe) {
      if (v.source === 'virustotal') threats.push(`VirusTotal: ${v.malicious}/${v.total} антивирусов`);
      else if (v.source === 'phishtank') threats.push('PhishTank: подтверждённый фишинг');
      else if (v.source === 'urlhaus') threats.push(`URLhaus: ${v.malwareType}${v.tags ? ' (' + v.tags + ')' : ''}`);
      else if (v.source === 'whois') threats.push(`WHOIS: домен создан ${v.ageDays} дней назад (${new Date(v.regDate).toLocaleDateString()})`);
      else if (v.threats) v.threats.forEach(t => threats.push(THREAT_LABELS[t.type] || t.type));
    }
  }

  const isSafe = threats.length === 0;
  sbCache.set(url, { safe: isSafe, time: Date.now() });
  if (!isSafe) incrementStats({ threats: threats.length, sitesChecked: 1 });
  else incrementStats({ sitesChecked: 1 });
  if (isSafe) return;

  if (!isSafe) {
    const threatList = threats.join('\n');
    _notifiedTabs.set(tabId, url); 

    try {
      api.notifications.create('eula_alert_' + tabId, {
        type: 'basic',
        iconUrl: api.runtime.getURL('icons/icon128.png'),
        title: 'ОПАСНЫЙ САЙТ!',
        message: `${hostname}\n${threatList}`,
        priority: 2,
        requireInteraction: true
      });
    } catch {}

    try {
      await api.scripting.executeScript({
        target: { tabId },
        func: (host, threats) => {
          if (document.getElementById('eula-sb-warning')) return;
          const overlay = document.createElement('div');
          overlay.id = 'eula-sb-warning';
          overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(220,38,38,.95);display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,sans-serif';
          overlay.innerHTML = `
            <div style="max-width:520px;background:#fff;border-radius:20px;padding:40px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.3)">
              
              <h1 style="font-size:24px;color:#dc2626;margin-bottom:8px">ОПАСНЫЙ САЙТ!</h1>
              <p style="font-size:16px;color:#111;margin-bottom:12px;font-weight:600">${host}</p>
              <p style="font-size:14px;color:#6b7280;margin-bottom:24px">${threats}</p>
              <p style="font-size:13px;color:#9ca3af;margin-bottom:24px">Службы безопасности определили этот сайт как опасный. Рекомендуем немедленно покинуть эту страницу.</p>
              <div style="display:flex;gap:12px;justify-content:center">
                <button id="eula-sb-back" style="padding:12px 32px;background:#dc2626;color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:600;cursor:pointer">← Назад в безопасность</button>
                <button id="eula-sb-ignore" style="padding:12px 32px;background:#f3f4f6;color:#6b7280;border:1px solid #e5e7eb;border-radius:12px;font-size:12px;cursor:pointer">Я понимаю риск</button>
              </div>
            </div>`;
          document.body.appendChild(overlay);
          document.getElementById('eula-sb-back').addEventListener('click', () => history.back());
          document.getElementById('eula-sb-ignore').addEventListener('click', () => overlay.remove());
        },
        args: [hostname, threatList]
      });
    } catch {}

    try {
      api.action.setBadgeText({ text: '!', tabId });
      api.action.setBadgeBackgroundColor({ color: '#dc2626', tabId });
    } catch {}
  }
}

const _redirectChains = new Map(); 
const REDIRECT_WINDOW_MS = 8000;   
const REDIRECT_THRESHOLD = 3;      

function trackRedirect(tabId, url) {
  try {
    const domain = new URL(url).hostname;
    const now = Date.now();
    let chain = _redirectChains.get(tabId) || [];
    
    chain = chain.filter(r => now - r.time < REDIRECT_WINDOW_MS);
    
    if (!chain.length || chain[chain.length - 1].domain !== domain) {
      chain.push({ url, domain, time: now });
    }
    _redirectChains.set(tabId, chain);
    
    const uniqueDomains = new Set(chain.map(r => r.domain));
    if (uniqueDomains.size >= REDIRECT_THRESHOLD) {
      const domainList = [...uniqueDomains].join(' -> ');
      _redirectChains.delete(tabId);
      
      try {
        api.notifications.create('eula_redirect_' + tabId, {
          type: 'basic', iconUrl: api.runtime.getURL('icons/icon128.png'),
          title: 'Подозрительные редиректы!',
          message: `Обнаружена цепочка редиректов через ${uniqueDomains.size} доменов: ${domainList}`,
          priority: 2
        });
      } catch {}
      try {
        api.scripting.executeScript({
          target: { tabId },
          func: (domains) => {
            if (document.getElementById('eula-redirect-warn')) return;
            const banner = document.createElement('div');
            banner.id = 'eula-redirect-warn';
            banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483646;background:#fff7ed;border-bottom:2px solid #fdba74;padding:10px 16px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:13px;color:#9a3412;display:flex;align-items:center;gap:10px';
            banner.innerHTML = '<span style="flex:1">Подозрительная цепочка редиректов через несколько доменов: <b>' + domains + '</b>. Это может быть попытка маскировки вредоносного URL.</span><button style="background:none;border:none;font-size:18px;cursor:pointer;color:#9a3412" onclick="this.parentElement.remove()"></button>';
            document.body.appendChild(banner);
          },
          args: [domainList]
        });
      } catch {}
    }
  } catch {}
}

const _navDebounce = new Map();
api.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  
  if (changeInfo.url) trackRedirect(tabId, changeInfo.url);
  if (changeInfo.status === 'complete' && tab.url) {
    const key = tabId + ':' + tab.url;
    if (_navDebounce.has(key)) clearTimeout(_navDebounce.get(key));
    _notifiedTabs.delete(tabId); 
    _navDebounce.set(key, setTimeout(() => { _navDebounce.delete(key); onTabNavigated(tabId, tab.url); }, 300));
    
    injectAllScripts(tabId, tab.url);
  }
});
api.tabs.onRemoved?.addListener(tabId => { _notifiedTabs.delete(tabId); _redirectChains.delete(tabId); });

api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'fetch_document') {
    fetchDocumentText(msg.url).then(sendResponse);
    return true;
  }
  if (msg.type === 'gemini_analyze') {
    analyzeWithGemini(msg.text, msg.docType).then(sendResponse);
    return true;
  }
  if (msg.type === 'check_api_key') {
    getApiKey().then(key => sendResponse({ hasKey: !!key }));
    return true;
  }
  if (msg.type === 'check_whitelist') {
    shouldSkipUrl(msg.url).then(skip => sendResponse({ skip }));
    return true;
  }
  if (msg.type === 'request_all_urls') {
    api.permissions.request({ origins: ['<all_urls>'] }).then(granted => {
      if (granted) updateAutoScan();
      sendResponse({ granted });
    });
    return true;
  }
  if (msg.type === 'update_autoscan') {
    updateAutoScan().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg.type === 'check_safe_browsing') {
    getSafeBrowsingKey().then(key => checkSafeBrowsingV4(msg.url, key)).then(sendResponse);
    return true;
  }
  if (msg.type === 'mailtm_create') {
    mailtmCreateAccount().then(result => {
      
      mailtmStartAutoPoll();
      sendResponse(result);
    }).catch(e => sendResponse({ error: e.message }));
    return true;
  }
  if (msg.type === 'mailtm_start_poll') {
    mailtmStartAutoPoll();
    sendResponse({ ok: true });
    return true;
  }
  if (msg.type === 'mailtm_stop_poll') {
    mailtmStopAutoPoll();
    sendResponse({ ok: true });
    return true;
  }
  if (msg.type === 'mailtm_poll') {
    mailtmPollMessages().then(sendResponse).catch(e => sendResponse({ error: e.message }));
    return true;
  }
  if (msg.type === 'mailtm_status') {
    mailtmGetStatus().then(sendResponse).catch(e => sendResponse({ error: e.message }));
    return true;
  }
  if (msg.type === 'mailtm_clear') {
    mailtmStopAutoPoll();
    mailtmClearSession().then(sendResponse).catch(e => sendResponse({ error: e.message }));
    return true;
  }
  if (msg.type === 'inject_scripts') {
    if (sender.tab) injectContentScripts(sender.tab.id).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg.type === 'analysis_complete' && sender.tab) {
    const { score, findings, url, notify } = msg.data;
    const color = score <= 20 ? '#4CAF50' : score <= 50 ? '#FF9800' : '#F44336';
    const text = findings > 0 ? String(findings) : '';
    try {
      api.action.setBadgeText({ text, tabId: sender.tab.id });
      api.action.setBadgeBackgroundColor({ color, tabId: sender.tab.id });
    } catch {}
    incrementStats({ scans: 1, ...(findings > 0 ? { threats: findings } : {}) });
    if (findings > 0 && notify && _notifiedTabs.get(sender.tab.id) !== url) {
      _notifiedTabs.set(sender.tab.id, url);
      const level = score <= 20 ? 'низкий' : score <= 50 ? 'средний' : 'ВЫСОКИЙ';
      try {
        api.notifications.create('eula_alert_' + sender.tab.id, {
          type: 'basic', iconUrl: api.runtime.getURL('icons/icon128.png'),
          title: 'MiniShield - Обнаружены риски!',
          message: `${findings} рисков (уровень: ${level}) на ${new URL(url).hostname}`,
          priority: score > 50 ? 2 : 1
        });
      } catch {}
    }
  }
  if (msg.type === 'tracker_stats' && sender.tab) {
    if (msg.data.blocked > 0) {
      try { api.action.setTitle({ title: `MiniShield - заблокировано ${msg.data.blocked} трекеров`, tabId: sender.tab.id }); } catch {}
      incrementStats({ trackers: msg.data.blocked });
    }
    if (msg.data.cookieBanners > 0) {
      incrementStats({ cookies: msg.data.cookieBanners });
    }
  }
});

const MAILTM_API  = 'https://api.mail.tm';
const MAILTM_KEY  = 'mailtm_session';
const MAILTM_TOUT = 12000;

function _mailtmRand(len = 12) {
  const abc = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < len; i++) s += abc[Math.floor(Math.random() * abc.length)];
  return s;
}

async function mailtmCreateAccount() {
  
  const dr = await fetch(`${MAILTM_API}/domains?page=1`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(MAILTM_TOUT)
  });
  if (!dr.ok) throw new Error('mail.tm domains HTTP ' + dr.status);
  const dd = await dr.json();
  let domains = dd['hydra:member'] || dd.member || [];
  
  if (!domains.length && Array.isArray(dd)) domains = dd;
  if (!domains.length) throw new Error('mail.tm: no domains available');
  const domain = domains[0].domain;

  const address  = _mailtmRand(10) + '@' + domain;
  const password = _mailtmRand(18);
  const ar = await fetch(`${MAILTM_API}/accounts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ address, password }),
    signal: AbortSignal.timeout(MAILTM_TOUT)
  });
  if (!ar.ok) {
    const txt = await ar.text().catch(() => '');
    throw new Error('mail.tm create HTTP ' + ar.status + (txt ? ': ' + txt.slice(0, 120) : ''));
  }
  const account = await ar.json();

  const tr = await fetch(`${MAILTM_API}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ address, password }),
    signal: AbortSignal.timeout(MAILTM_TOUT)
  });
  if (!tr.ok) throw new Error('mail.tm token HTTP ' + tr.status);
  const tokenData = await tr.json();

  const session = {
    address, password,
    token: tokenData.token,
    accountId: account.id || null,
    seenIds: [],
    createdAt: Date.now()
  };
  await api.storage.local.set({ [MAILTM_KEY]: session });
  return { address };
}

async function mailtmRefreshToken() {
  const d = await api.storage.local.get(MAILTM_KEY);
  const session = d[MAILTM_KEY];
  if (!session?.address || !session?.password) return null;
  try {
    const tr = await fetch(`${MAILTM_API}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ address: session.address, password: session.password }),
      signal: AbortSignal.timeout(MAILTM_TOUT)
    });
    if (!tr.ok) return null;
    const tokenData = await tr.json();
    session.token = tokenData.token;
    await api.storage.local.set({ [MAILTM_KEY]: session });
    console.log('[MiniShield] mail.tm token refreshed');
    return session;
  } catch { return null; }
}

async function mailtmPollMessages() {
  const d = await api.storage.local.get(MAILTM_KEY);
  let session = d[MAILTM_KEY];
  if (!session?.token) return { error: 'no_session' };

  let mr = await fetch(`${MAILTM_API}/messages?page=1`, {
    headers: { Authorization: 'Bearer ' + session.token, Accept: 'application/json' },
    signal: AbortSignal.timeout(MAILTM_TOUT)
  }).catch(e => ({ ok: false, _err: e.message }));

  if (mr.status === 401) {
    session = await mailtmRefreshToken();
    if (!session) return { error: 'auth_expired' };
    mr = await fetch(`${MAILTM_API}/messages?page=1`, {
      headers: { Authorization: 'Bearer ' + session.token, Accept: 'application/json' },
      signal: AbortSignal.timeout(MAILTM_TOUT)
    }).catch(e => ({ ok: false, _err: e.message }));
  }

  if (!mr.ok) {
    return { error: 'poll HTTP ' + (mr.status || mr._err) };
  }

  const md = await mr.json();
  let messages = md['hydra:member'] || md.member || [];
  
  if (!messages.length && Array.isArray(md)) messages = md;
  const newMsgs = messages.filter(m => !session.seenIds.includes(m.id));
  console.log(`[MiniShield] poll: ${messages.length} total, ${newMsgs.length} new`);
  if (!newMsgs.length) return { messages: [] };

  session.seenIds = [...session.seenIds, ...newMsgs.map(m => m.id)].slice(-200);
  await api.storage.local.set({ [MAILTM_KEY]: session });

  const fullMsgs = [];
  for (const msg of newMsgs.slice(0, 5)) {
    try {
      const fr = await fetch(`${MAILTM_API}/messages/${msg.id}`, {
        headers: { Authorization: 'Bearer ' + session.token, Accept: 'application/json' },
        signal: AbortSignal.timeout(MAILTM_TOUT)
      });
      if (fr.ok) fullMsgs.push(await fr.json());
    } catch {}
  }

  function stripHtml(html) {
    return html
      .replace(/<\/td>/gi, ' ')       
      .replace(/<\/div>/gi, ' ')       
      .replace(/<br\s*\/?>/gi, ' ')    
      .replace(/<[^>]+>/g, '')         
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#?\w+;/g, ' ')        
      .replace(/\s+/g, ' ')
      .trim();
  }

  const NOT_A_CODE = /^(code|verify|token|confirmation|verification|password|passcode|security|activation|please|click|enter|your|this|that|here|from|with|have|will|been|more|about|account|email|login|link|button|open|copy|paste|below|above|valid|expire|minute|hour|second|digit|number)$/i;

  function extractCode(text) {
    
    const clean = text.replace(/[\u200B-\u200D\uFEFF\u00AD]/g, '').replace(/\s+/g, ' ');
    const pats = [
      
      /(?:код|code|otp|pin|token|пароль|password|passcode|verify|verification|confirmation|подтвержден\w*|одноразов\w*|activat\w*|security)[:\s\-=]+(\d[\d\-\s]{2,9}\d)/i,
      
      /(?:code|pin|otp|passcode|код)\s+(?:is|:|—|-)\s*(\d{4,8})/i,
      
      /(?:^|\s)(\d(?:\s+\d){3,7})(?:\s|$)/,
      
      /\b(\d{6})\b/,
      /\b(\d{8})\b/,
      /\b(\d{5})\b/,
      /\b(\d{4})\b/,
      /\b(\d{7})\b/,
      
      /\b(\d{3}-\d{3})\b/,
      /\b(\d{4}-\d{4})\b/,
      
      /(?:код|code|otp|pin|token|passcode|verification|confirmation)[:\s\-=]+([A-Za-z0-9]{4,10})/i,
      
      /\b((?=(?:[A-Za-z]*\d){2})(?=[A-Za-z0-9]*[A-Za-z])[A-Za-z0-9]{4,10})\b/
    ];
    for (const p of pats) {
      const m = clean.match(p);
      if (m) {
        const candidate = m[1].replace(/[\s\-]/g, '');
        
        if (NOT_A_CODE.test(candidate)) continue;
        if (candidate.length < 4) continue;
        return candidate;
      }
    }
    return null;
  }

  function extractCodeFromHtml(html) {
    if (!html) return null;
    const htmlPats = [
      
      /(?:<b[^>]*>|<strong[^>]*>|<code[^>]*>|<span[^>]*font-size[^>]*>)\s*(\d{4,8})\s*(?:<\/b>|<\/strong>|<\/code>|<\/span>)/i,
      
      /(<td[^>]*>\s*\d\s*<\/td>\s*){4,8}/i,
      
      /style="[^"]*(?:font-size:\s*(?:2[0-9]|3[0-9]|4[0-9])|letter-spacing)[^"]*"[^>]*>\s*([\d\s\-]{4,20})\s*</i
    ];
    
    const tdMatch = html.match(/(<td[^>]*>\s*\d\s*<\/td>\s*){4,8}/i);
    if (tdMatch) {
      const digits = tdMatch[0].replace(/<[^>]+>/g, '').replace(/\s/g, '');
      if (digits.length >= 4 && digits.length <= 8) return digits;
    }
    for (const p of htmlPats) {
      if (p === htmlPats[1]) continue; 
      const m = html.match(p);
      if (m && m[1]) return m[1].replace(/[\s\-]/g, '');
    }
    return null;
  }

  function toStr(val) {
    if (!val) return '';
    if (typeof val === 'string') return val;
    if (Array.isArray(val)) return val.join(' ');
    if (typeof val === 'object') {
      
      return val.content || val.body || val.value || val.html || JSON.stringify(val);
    }
    return String(val);
  }

  const codes = [];
  for (const m of fullMsgs) {
    const htmlStr = toStr(m.html);
    const textStr = toStr(m.text);
    const subjectStr = toStr(m.subject);
    let code = null;

    console.log('[MiniShield] Processing email:',
      '\n  subject:', subjectStr,
      '\n  from:', m.from?.address,
      '\n  text type:', typeof m.text, 'length:', textStr.length,
      '\n  html type:', typeof m.html, 'length:', htmlStr.length,
      '\n  text preview:', textStr.slice(0, 300),
      '\n  html preview:', htmlStr.slice(0, 300)
    );

    if (subjectStr) code = extractCode(subjectStr);
    
    if (!code && htmlStr) code = extractCodeFromHtml(htmlStr);
    
    if (!code && textStr) code = extractCode(textStr);
    
    if (!code && htmlStr) code = extractCode(stripHtml(htmlStr));
    
    if (!code) {
      const combined = textStr + ' ' + stripHtml(htmlStr);
      code = extractCode(combined);
    }
    if (code) {
      codes.push({ code, subject: subjectStr, from: m.from?.address || '' });
      console.log('[MiniShield] Code found:', code, 'from:', m.from?.address);
    } else {
      console.log('[MiniShield] No code found in email from:', m.from?.address);
    }
  }

  return {
    messages: fullMsgs.map(m => ({ id: m.id, from: m.from?.address, subject: m.subject })),
    codes
  };
}

async function mailtmGetStatus() {
  const d = await api.storage.local.get(MAILTM_KEY);
  const s = d[MAILTM_KEY];
  if (!s) return { active: false };
  if (Date.now() - s.createdAt > 24 * 60 * 60 * 1000) {
    await api.storage.local.remove(MAILTM_KEY);
    mailtmStopAutoPoll();
    return { active: false };
  }
  return { active: true, address: s.address };
}

async function mailtmClearSession() {
  mailtmStopAutoPoll();
  await api.storage.local.remove(MAILTM_KEY);
  return { ok: true };
}

let _mailtmPollTimer = null;
let _mailtmPollStart = 0;
const MAILTM_POLL_INTERVAL = 5000;   
const MAILTM_POLL_MAX_TIME = 5 * 60 * 1000; 

function mailtmStartAutoPoll() {
  mailtmStopAutoPoll();
  _mailtmPollStart = Date.now();
  console.log('[MiniShield] auto-poll started');
  _mailtmPollTimer = setInterval(async () => {
    
    if (Date.now() - _mailtmPollStart > MAILTM_POLL_MAX_TIME) {
      console.log('[MiniShield] auto-poll stopped (timeout)');
      mailtmStopAutoPoll();
      return;
    }
    try {
      const result = await mailtmPollMessages();
      if (result.codes && result.codes.length > 0) {
        console.log('[MiniShield] auto-poll found code:', result.codes[0].code);
        
        const tabs = await api.tabs.query({ active: true, currentWindow: true });
        for (const tab of tabs) {
          try {
            api.tabs.sendMessage(tab.id, {
              type: 'mailtm_code_found',
              codes: result.codes,
              messages: result.messages
            });
          } catch {}
        }
        
        try {
          api.notifications.create('mailtm_code', {
            type: 'basic',
            iconUrl: api.runtime.getURL('icons/icon128.png'),
            title: 'MiniShield — Код получен!',
            message: `Код: ${result.codes[0].code} (от ${result.codes[0].from})`,
            priority: 2
          });
        } catch {}
      }
    } catch (e) {
      console.warn('[MiniShield] auto-poll error:', e.message);
    }
  }, MAILTM_POLL_INTERVAL);
}

function mailtmStopAutoPoll() {
  if (_mailtmPollTimer) {
    clearInterval(_mailtmPollTimer);
    _mailtmPollTimer = null;
    console.log('[MiniShield] auto-poll stopped');
  }
}

api.runtime.onInstalled.addListener(async () => {
  const d = await api.storage.local.get('eula_alert_settings');
  if (!d.eula_alert_settings) {
    await api.storage.local.set({
      eula_alert_settings: {
        autoScan: true, autoScanAll: false, autoFill: false, language: 'ru',
        riskLevel: 'all', showBadge: true, useAI: true,
        blockCookies: true, antiTracker: false, blockSocial: false, blockErrorTrackers: false, safeBrowsing: true, notifications: true,
        safeBrowsingApiKey: '',
        virusTotal: true,
        virusTotalApiKey: '',
        phishTank: true,
        urlHaus: true,
        checkDomainAge: true,
        formSecurity: true,
        blockCryptoMiners: true,
        detectHiddenIframes: true,
        detectObfuscatedJS: true,
        detectExtInstall: true,
        detectRedirects: true,
        geminiApiKey: '',
        cookiePolicy: { functional: true, analytics: false, advertising: false }
      }
    });
  }
  const w = await api.storage.local.get('eula_alert_whitelist');
  if (!w.eula_alert_whitelist) {
    await api.storage.local.set({ eula_alert_whitelist: [] });
  }
  updateAutoScan();
});