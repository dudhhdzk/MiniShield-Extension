(() => {
  'use strict';
  if (window.__eula_alert_loaded) return;
  window.__eula_alert_loaded = true;
  const api = typeof browser !== 'undefined' ? browser : chrome;
  const t = (key, fallback) => {
    try {
      return api.i18n.getMessage(key) || fallback;
    } catch {
      return fallback;
    }
  };
  let panelElement = null,
    analysisResult = null;

  function injectStyles() {
    if (document.getElementById('eula-alert-styles')) return;
    const link = document.createElement('link');
    link.id = 'eula-alert-styles';
    link.rel = 'stylesheet';
    link.href = api.runtime.getURL('styles/content.css');
    (document.head || document.documentElement).appendChild(link);
  }
  injectStyles();

  function checkWhitelist() {
    return new Promise((resolve) => {
      api.runtime.sendMessage({ type: 'check_whitelist', url: location.href }, (response) => {
        if (api.runtime.lastError) {
          resolve(false);
          return;
        }
        resolve(response?.skip || false);
      });
    });
  }

  function createFloatingBadge(riskCount) {
    const existing = document.getElementById('eula-alert-badge');
    const oldPos = existing
      ? { left: existing.style.left, top: existing.style.top, moved: existing.dataset.moved }
      : null;
    if (existing) existing.remove();
    const badge = document.createElement('div');
    badge.id = 'eula-alert-badge';
    badge.innerHTML = `<div class="eula-alert-badge-inner"><img src="${api.runtime.getURL('images/logo.png')}" width="22" height="22" style="border-radius:4px;display:block" alt="">${riskCount > 0 ? `<span class="eula-alert-badge-count">${riskCount}</span>` : ''}</div>`;
    if (oldPos?.moved === '1') {
      badge.style.left = oldPos.left;
      badge.style.top = oldPos.top;
      badge.style.right = 'auto';
      badge.style.bottom = 'auto';
      badge.dataset.moved = '1';
    }
    let isDragging = false,
      startX,
      startY,
      badgeX,
      badgeY,
      dragMoved = false;
    badge.addEventListener('pointerdown', (e) => {
      isDragging = true;
      dragMoved = false;
      startX = e.clientX;
      startY = e.clientY;
      const r = badge.getBoundingClientRect();
      badgeX = r.left;
      badgeY = r.top;
      badge.setPointerCapture(e.pointerId);
      badge.style.transition = 'none';
      e.preventDefault();
    });
    badge.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX,
        dy = e.clientY - startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragMoved = true;
      if (!dragMoved) return;
      badge.style.left = Math.max(0, Math.min(window.innerWidth - 60, badgeX + dx)) + 'px';
      badge.style.top = Math.max(0, Math.min(window.innerHeight - 60, badgeY + dy)) + 'px';
      badge.style.right = 'auto';
      badge.style.bottom = 'auto';
      badge.dataset.moved = '1';
    });
    badge.addEventListener('pointerup', () => {
      isDragging = false;
      badge.style.transition = '';
      if (!dragMoved) togglePanel();
    });

    function snapBadgeToCorner() {
      const b = document.getElementById('eula-alert-badge');
      if (!b) return;
      b.style.transition = 'left .3s ease, top .3s ease';
      b.style.left = 'auto';
      b.style.top = 'auto';
      b.style.right = '18px';
      b.style.bottom = '18px';
      b.dataset.moved = '';
      setTimeout(() => {
        b.style.transition = '';
      }, 350);
    }
    let resizeTimer;
    function onResize() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const isFS =
          (window.innerWidth === screen.width && window.innerHeight === screen.height) ||
          !!document.fullscreenElement ||
          !!document.webkitFullscreenElement;
        if (isFS) snapBadgeToCorner();

        const b = document.getElementById('eula-alert-badge');
        if (b && b.dataset.moved === '1') {
          const r = b.getBoundingClientRect();
          if (r.left > window.innerWidth - 20 || r.top > window.innerHeight - 20)
            snapBadgeToCorner();
        }
      }, 150);
    }

    if (window._eulaResizeHandler) window.removeEventListener('resize', window._eulaResizeHandler);
    if (window._eulaFsHandler)
      document.removeEventListener('fullscreenchange', window._eulaFsHandler);
    if (window._eulaWkFsHandler)
      document.removeEventListener('webkitfullscreenchange', window._eulaWkFsHandler);
    window._eulaResizeHandler = onResize;
    window._eulaFsHandler = () => {
      if (document.fullscreenElement) snapBadgeToCorner();
    };
    window._eulaWkFsHandler = () => {
      if (document.webkitFullscreenElement) snapBadgeToCorner();
    };
    window.addEventListener('resize', window._eulaResizeHandler);
    document.addEventListener('fullscreenchange', window._eulaFsHandler);
    document.addEventListener('webkitfullscreenchange', window._eulaWkFsHandler);

    document.body.appendChild(badge);
  }

  function createPanel() {
    if (panelElement) {
      panelElement.remove();
      panelElement = null;
    }
    const panel = document.createElement('div');
    panel.id = 'eula-alert-panel';
    panel.innerHTML = `<div class="eula-alert-panel-header"><div class="eula-alert-panel-title"><img src="${api.runtime.getURL('images/logo.png')}" width="20" height="20" style="border-radius:4px" alt=""><span>MiniShield</span></div><button class="eula-alert-panel-close" id="eula-alert-close">\u2715</button></div><div class="eula-alert-panel-body" id="eula-alert-body"><div class="eula-alert-loading"><div class="eula-alert-spinner"></div><span>Анализирую документы...</span></div></div>`;
    document.body.appendChild(panel);
    panel.querySelector('#eula-alert-close').addEventListener('click', () => togglePanel(false));
    panelElement = panel;
  }

  function togglePanel(forceShow) {
    if (!panelElement) createPanel();
    const show =
      typeof forceShow === 'boolean'
        ? forceShow
        : !panelElement.classList.contains('eula-alert-panel-visible');
    panelElement.classList.toggle('eula-alert-panel-visible', show);
    if (show && analysisResult) renderResults(analysisResult);
  }

  function escHtml(s) {
    const d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  }

  function renderResults(data) {
    const body = document.getElementById('eula-alert-body');
    if (!body) return;

    let totalFindings = 0;
    for (const d of data.results) {
      totalFindings += d.findings.length;
      if (d.aiRisks) totalFindings += d.aiRisks.length;
    }
    const stats = window.CookieBlocker
      ? CookieBlocker.getStats()
      : { blockedTrackers: 0, cookieBannerHandled: false };
    const nothingBlocked =
      totalFindings === 0 &&
      stats.blockedTrackers === 0 &&
      !stats.cookieBannerHandled &&
      data.score <= 20;

    if (nothingBlocked) {
      const pigUrl = api.runtime.getURL('images/pig_safe.png');
      body.innerHTML =
        `<div style="display:flex;flex-direction:column;align-items:center;min-height:320px;text-align:center;padding:24px 16px">` +
        `<div style="font-size:17px;font-weight:700;color:#2e7d32;margin-bottom:4px">На этом сайте нечего блокировать</div>` +
        `<div style="font-size:13px;color:#6b7280;line-height:1.5;margin-bottom:16px">Документы EULA/ToS не найдены,<br>трекеры и cookie-баннеры отсутствуют.</div>` +
        `<img src="${pigUrl}" style="max-width:220px;width:100%;height:auto;border-radius:12px" alt="safe">` +
        `</div>`;
      return;
    }

    const scoreColor = data.score <= 20 ? '#4CAF50' : data.score <= 50 ? '#FF9800' : '#F44336';
    const scoreLabel =
      data.score <= 20
        ? t('scoreLow', 'Низкий риск')
        : data.score <= 50
          ? t('scoreMedium', 'Средний риск')
          : t('scoreHigh', 'Высокий риск');
    let html = '';

    if (data.rateLimited) {
      html += `<div class="eula-alert-rate-limit-bar">${t('rateLimitPanel', 'Лимит API исчерпан - ИИ-анализ временно недоступен. Подождите минуту.')}</div>`;
    }
    if (stats.blockedTrackers > 0 || stats.cookieBannerHandled) {
      html += `<div class="eula-alert-protection-bar">`;
      if (stats.cookieBannerHandled)
        html += `<span class="eula-alert-prot-item">${t('cookieBannerDone', 'Cookie-баннер обработан')}</span>`;
      if (stats.blockedTrackers > 0)
        html += `<span class="eula-alert-prot-item">${t('trackersCount', 'Трекеров')}: ${stats.blockedTrackers}</span>`;
      html += `</div>`;
    }
    html += `<div class="eula-alert-score" style="--score-color:${scoreColor}"><div class="eula-alert-score-circle"><svg viewBox="0 0 36 36" class="eula-alert-score-svg"><path class="eula-alert-score-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/><path class="eula-alert-score-fg" stroke="${scoreColor}" stroke-dasharray="${data.score},100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/><text x="18" y="20.35" class="eula-alert-score-text" transform="rotate(90,18,18)">${data.score}</text></svg></div><div class="eula-alert-score-label" style="color:${scoreColor}">${scoreLabel}</div></div>`;
    const aiDoc = data.results.find((d) => d.aiSummary);
    if (aiDoc)
      html += `<div class="eula-alert-ai-box"><div class="eula-alert-ai-head">${t('aiAnalysis', 'ИИ-анализ')}</div><div class="eula-alert-ai-summary">${escHtml(aiDoc.aiSummary)}</div>${aiDoc.aiRecommendation ? `<div class="eula-alert-ai-rec">${escHtml(aiDoc.aiRecommendation)}</div>` : ''}</div>`;
    if (data.results.length === 0)
      html += `<div class="eula-alert-empty">${t('noDocsFound', 'Документы EULA/ToS/Privacy Policy не найдены.')}</div>`;
    for (const doc of data.results) {
      html += `<div class="eula-alert-doc-section"><div class="eula-alert-doc-title">${doc.type === 'privacy' ? '[P]' : '[D]'} <a href="${doc.url}" target="_blank">${escHtml(doc.text || doc.url)}</a></div><div class="eula-alert-doc-meta">${Math.round(doc.docLength / 1000)}${t('kChars', 'K символов')}</div>`;
      if (doc.aiRisks?.length) {
        html += `<div class="eula-alert-subsection">${t('aiRisks', 'Риски по ИИ')}</div>`;
        for (const r of doc.aiRisks)
          html += renderFinding({
            icon: '',
            label: r.category,
            severity: r.severity,
            desc: r.description,
            excerpt: r.excerpt,
            docUrl: doc.url,
          });
      }
      if (doc.findings.length > 0) {
        html += `<div class="eula-alert-subsection">${t('patterns', 'Паттерны')}</div>`;
        for (const f of doc.findings)
          html += renderFinding({
            icon: f.icon,
            label: f.label,
            severity: f.severity,
            excerpts: f.excerpts,
            docUrl: doc.url,
          });
      }
      if (!doc.findings.length && (!doc.aiRisks || !doc.aiRisks.length))
        html += `<div class="eula-alert-finding-ok">${t('noRisksFound', 'Явных рисков не обнаружено')}</div>`;
      html += `</div>`;
    }
    const cbs = window.FormHelper ? FormHelper.detectCheckboxes() : [];
    if (cbs.length) {
      html += `<div class="eula-alert-section-title">${t('checkboxes', 'Чекбоксы')}</div>`;
      for (const cb of cbs)
        html += `<div class="eula-alert-checkbox-warn"><span>${cb.icon}</span><span>${escHtml(cb.label)}</span><span class="eula-alert-cb-status">${cb.checked ? '' : ''}</span></div>`;
    }
    html += `<div class="eula-alert-actions"><button class="eula-alert-btn eula-alert-btn-fill" id="eula-alert-autofill">${t('btnSafeAutofill', 'Безопасное автозаполнение')}</button><button class="eula-alert-btn eula-alert-btn-cookie" id="eula-alert-block-cookie">${t('btnAutoCookie', 'Авто-запрет cookie')}</button><div class="eula-alert-hint">${t('finalClick', 'Финальный клик - за вами!')}</div></div>`;
    body.innerHTML = html;
    document.getElementById('eula-alert-autofill')?.addEventListener('click', async () => {
      if (!window.FormHelper) return;
      const r = await FormHelper.autoFill();
      const b = document.getElementById('eula-alert-autofill');
      if (b) {
        b.textContent =
          r.filled > 0
            ? `${t('filledCount', 'Заполнено')} ${r.filled}/${r.total}`
            : `${t('noData', 'Нет данных')}`;
        b.disabled = true;
      }
    });
    document.getElementById('eula-alert-block-cookie')?.addEventListener('click', () => {
      if (window.CookieBlocker) CookieBlocker.hideCookieBanners();
      const b = document.getElementById('eula-alert-block-cookie');
      if (b) {
        b.textContent = `${t('processed', 'Обработано')}`;
        b.disabled = true;
      }
    });
  }

  function renderFinding({ icon, label, severity, desc, excerpt, excerpts, docUrl }) {
    const sev =
      {
        critical: t('sevCritical', 'КРИТИЧЕСКИЙ'),
        high: t('sevHigh', 'ВЫСОКИЙ'),
        medium: t('sevMedium', 'СРЕДНИЙ'),
        low: t('sevLow', 'НИЗКИЙ'),
      }[severity] || severity;
    const sevCss = severity;
    let h = `<div class="eula-alert-finding eula-alert-severity-${sevCss}"><div class="eula-alert-finding-head"><span class="eula-alert-finding-icon">${icon}</span><span class="eula-alert-finding-label">${escHtml(label)}</span><span class="eula-alert-finding-badge eula-alert-sev-${sevCss}">${sev}</span></div>`;
    if (desc) h += `<div class="eula-alert-finding-desc">${escHtml(desc)}</div>`;
    if (excerpt)
      h += `<div class="eula-alert-finding-excerpts"><div class="eula-alert-excerpt">...${escHtml(excerpt)}...</div></div>`;
    if (excerpts?.length)
      h += `<div class="eula-alert-finding-excerpts">${excerpts.map((e) => `<div class="eula-alert-excerpt">...${escHtml(e)}...</div>`).join('')}</div>`;
    if (docUrl)
      h += `<a href="${docUrl}" target="_blank" class="eula-alert-finding-link">${t('readOriginal', 'Читать в оригинале >')}</a>`;
    return h + `</div>`;
  }

  async function init() {
    if (window.CookieBlocker) CookieBlocker.init();

    if (!window.EulaAlertStorage) return;
    const settings = await EulaAlertStorage.getSettings();
    if (!settings.autoScan) return;

    const skip = await checkWhitelist();
    if (skip) {
      console.info('EulaAlert: сайт в белом списке или поисковик - пропускаю');
      return;
    }

    if (!window.FormHelper || !FormHelper.isRegistrationPage()) {
      const tosLinks = window.TosAnalyzer ? TosAnalyzer.findTosLinks() : [];
      if (!tosLinks.length) return;
    }
    createFloatingBadge(0);
    if (!window.TosAnalyzer) return;
    analysisResult = await TosAnalyzer.analyzeAll();
    let total = 0;
    for (const d of analysisResult.results) {
      total += d.findings.length;
      if (d.aiRisks) total += d.aiRisks.length;
    }
    createFloatingBadge(total);
    if (analysisResult.results.length > 0 && window.EulaAlertStorage)
      await EulaAlertStorage.addHistoryEntry({
        url: location.href,
        title: document.title,
        score: analysisResult.score,
        findings: total,
      });
    const hasCritical = analysisResult.results.some(
      (d) =>
        d.findings.some((f) => f.severity === 'critical' || f.severity === 'high') ||
        d.aiRisks?.some((r) => r.severity === 'critical' || r.severity === 'high')
    );
    if (hasCritical && settings.showBadge) {
      createPanel();
      setTimeout(() => togglePanel(true), 500);
    }
    try {
      api.runtime.sendMessage({
        type: 'analysis_complete',
        data: {
          url: location.href,
          score: analysisResult.score,
          findings: total,
          notify: settings.notifications,
        },
      });
    } catch {}
    setTimeout(() => {
      const s = window.CookieBlocker ? CookieBlocker.getStats() : { blockedTrackers: 0 };
      if (s.blockedTrackers > 0) {
        try {
          api.runtime.sendMessage({
            type: 'tracker_stats',
            data: { blocked: s.blockedTrackers, cookieBanners: s.cookieBannerHandled ? 1 : 0 },
          });
        } catch {}
      }
    }, 3000);
  }

  async function runManualScan() {
    createFloatingBadge(0);
    createPanel();
    togglePanel(true);

    if (!window.TosAnalyzer) return;
    analysisResult = await TosAnalyzer.analyzeAll();
    let total = 0;
    for (const d of analysisResult.results) {
      total += d.findings.length;
      if (d.aiRisks) total += d.aiRisks.length;
    }
    createFloatingBadge(total);
    renderResults(analysisResult);
    if (analysisResult.results.length > 0 && window.EulaAlertStorage)
      await EulaAlertStorage.addHistoryEntry({
        url: location.href,
        title: document.title,
        score: analysisResult.score,
        findings: total,
      });
    try {
      api.runtime.sendMessage({
        type: 'analysis_complete',
        data: { url: location.href, score: analysisResult.score, findings: total, notify: false },
      });
    } catch {}
  }

  window.__eula_alert_actions = {
    toggle_panel: () => runManualScan(),
    run_autofill: () => {
      if (window.FormHelper) FormHelper.autoFill();
    },
    run_analysis: () => init(),
    run_cookie_block: () => {
      if (window.CookieBlocker) CookieBlocker.hideCookieBanners();
    },
    run_social_block: () => {
      if (window.CookieBlocker) CookieBlocker.blockSocial();
    },
  };

  api.runtime.onMessage.addListener((msg) => {
    const action = window.__eula_alert_actions?.[msg.type];
    if (action) action();
  });

  function scheduleInit() {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => init(), { timeout: 2000 });
    } else {
      setTimeout(init, 800);
    }
  }
  if (document.readyState === 'complete') scheduleInit();
  else window.addEventListener('load', scheduleInit);
})();
