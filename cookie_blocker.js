(function () {
  if (window.__eula_cookie_blocker_v30) return;
  window.__eula_cookie_blocker_v30 = true;

  const CAT_NECESSARY = 0;
  const CAT_FUNCTIONAL = 1;
  const CAT_ANALYTICS = 2;
  const CAT_ADVERTISING = 3;

  // Session & authentication - essential for site functionality
  const SESSION_COOKIES = new Map([
    ['PHPSESSID', 0],
    ['JSESSIONID', 0],
    ['ASP.NET_SessionId', 0],
    ['session', 0],
    ['sid', 0],
    ['connect.sid', 0],
  ]);

  // CSRF protection tokens - also essential
  const CSRF_TOKENS = {
    csrftoken: 0,
    csrf_token: 0,
    _csrf: 0,
    __RequestVerificationToken: 0,
  };

  // Payment & cart (Stripe handles securely)
  const PAYMENT_COOKIES = {
    __stripe_mid: 0,
    __stripe_sid: 0,
  };

  // Cart functionality
  const CART_IDENTIFIERS = {
    cart: 0,
    cart_id: 0,
  };

  // Security & infrastructure
  const INFRASTRUCTURE = {
    __cflb: 0,
    __cf_bm: 0,
  };

  // Consent management - needs explicit tracking
  const CONSENT_MARKERS = [
    'CookieConsent',
    'OptanonConsent',
    'cookie_consent',
    'gdpr-last-interaction',
    'euconsent-v2',
    'OptanonAlertBoxClosed',
  ];

  // User preferences - functional but non-tracking
  const PREFERENCE_NAMES = new Set([
    'lang', 'language', 'locale', 'i18n',
    'theme', 'dark_mode', 'timezone',
    'PREF', 'prefs'
  ]);

  // Google Analytics (classic & new)
  const GOOGLE_ANALYTICS_PATTERN = /^_ga(_\w+)?$/i;
  const GOOGLE_TRACKING_LEGACY = {
    '_gid': 2, '_gat': 2,
    '__utma': 2, '__utmb': 2, '__utmc': 2,
    '__utmz': 2, '__utmt': 2,
  };

  // Yandex Metrika
  const YANDEX_TRACKING = {
    '_ym_uid': 2, '_ym_d': 2,
    '_ym_isad': 2, '_ym_visorc': 2,
    'yandexuid': 2,
  };

  // Heatmap & session recording tools
  const HEATMAP_TOOLS = {
    '_hjid': 2,
    '_hjSessionUser*': 2,
    '_hjSession*': 2,
    '_hjAbsoluteSessionInProgress': 2,
    'hotjar.com': 2,
    'mouseflow.com': 2,
    'fullstory.com': 2,
  };

  // Product analytics
  const PRODUCT_ANALYTICS = {
    'amplitude_id*': 2,
    'amplitude.com': 2,
    'ajs_anonymous_id': 2,
    'ajs_user_id': 2,
    'segment.io': 2,
    'segment.com': 2,
    'mixpanel.com': 2,
    'mp_*_mixpanel': 2,
  };

  // Error tracking & monitoring
  const ERROR_TRACKING = {
    'sentry-sc': 2,
    '__sentry': 2,
    'sentryReplaySession': 2,
    'sentry.io': 2,
    'bugsnag.com': 2,
    '_bugsnag': 2,
    '_rollbar': 2,
    'rollbar.com': 2,
    'trackjs.com': 2,
    '_raygun': 2,
    'raygun.com': 2,
  };

  // Facebook tracking
  const FACEBOOK_ADS = {
    '_fbp': 3,
    '_fbc': 3,
    'fr': 3,
    'facebook.com': 3,
    'facebook.net': 3,
    'fbcdn.net': 3,
  };

  // Google advertising network
  const GOOGLE_ADS = {
    '_gcl_au': 3,
    '_gcl_aw': 3,
    'IDE': 3,
    'DSID': 3,
    'test_cookie': 3,
    'NID': 3,
    '__gads': 3,
    '__gpi': 3,
    'doubleclick.net': 3,
    'googlesyndication.com': 3,
    'googleadservices.com': 3,
  };

  // Other advertising networks
  const AD_NETWORKS = {
    '_pin_unauth': 3,
    '_tt_enable_cookie': 3,
    '_ttp': 3,
    'li_sugr': 3,
    'bcookie': 3,
    'lidc': 3,
    'UserMatchHistory': 3,
    'muc_ads': 3,
    'personalization_id': 3,
    'guest_id_ads': 3,
    '_uetsid': 3,
    '_uetvid': 3,
    'MUID': 3,
    'mc': 3,
    'criteo.com': 3,
    'taboola.com': 3,
    'outbrain.com': 3,
  };

  // Build unified KNOWN_NAMES map from categories
  const KNOWN_NAMES = Object.assign({},
    SESSION_COOKIES,
    CSRF_TOKENS,
    PAYMENT_COOKIES,
    CART_IDENTIFIERS,
    INFRASTRUCTURE,
    CONSENT_MARKERS.reduce((acc, name) => { acc[name] = 0; return acc; }, {}),
    Array.from(PREFERENCE_NAMES).reduce((acc, name) => { acc[name] = 1; return acc; }, {}),
    GOOGLE_TRACKING_LEGACY,
    YANDEX_TRACKING,
    HEATMAP_TOOLS,
    PRODUCT_ANALYTICS,
    ERROR_TRACKING,
    FACEBOOK_ADS,
    GOOGLE_ADS,
    AD_NETWORKS,
    { 'sentry-sc': 2, '_lr_env_src_ats': 2, 'LogRocket': 2 }
  );

  const TRACKER_DOMAINS = Object.assign(
    {},
    // Google ecosystem
    {
      'doubleclick.net': 3,
      'googlesyndication.com': 3,
      'googleadservices.com': 3,
      'google-analytics.com': 2,
      'googletagmanager.com': 2,
      'analytics.google.com': 2,
    },
    // Meta/Facebook
    {
      'facebook.com': 3,
      'facebook.net': 3,
      'fbcdn.net': 3,
    },
    // Yandex
    {
      'mc.yandex.ru': 2,
      'metrika.yandex.ru': 2,
    },
    // Heatmaps & session recording
    {
      'hotjar.com': 2,
      'clarity.ms': 2,
      'mouseflow.com': 2,
      'fullstory.com': 2,
      'logrocket.com': 2,
    },
    // Error tracking
    {
      'sentry.io': 2,
      'sentry-cdn.com': 2,
      'browser.sentry-cdn.com': 2,
      'bugsnag.com': 2,
      'rollbar.com': 2,
      'api.rollbar.com': 2,
      'trackjs.com': 2,
      'usage.trackjs.com': 2,
      'raygun.com': 2,
      'raygun.io': 2,
      'airbrake.io': 2,
      'api.airbrake.io': 2,
      'exceptionless.com': 2,
      'honeybadger.io': 2,
      'js.honeybadger.io': 2,
      'atatus.com': 2,
      'api.atatus.com': 2,
      'logrocket.io': 2,
      'cdn.logrocket.io': 2,
      'r.lr-in.com': 2,
      'r.lr-ingest.io': 2,
      'errlytic.com': 2,
      'catchjs.com': 2,
      'getsentry.net': 2,
      'ingest.sentry.io': 2,
    },
    // Analytics & product tracking
    {
      'segment.io': 2,
      'segment.com': 2,
      'mixpanel.com': 2,
      'amplitude.com': 2,
      'hubspot.com': 2,
      'hs-analytics.net': 2,
    },
    // Ad networks
    {
      'criteo.com': 3,
      'criteo.net': 3,
      'taboola.com': 3,
      'outbrain.com': 3,
      'adnxs.com': 3,
      'adsrvr.org': 3,
      'rubiconproject.com': 3,
      'ads-twitter.com': 3,
      'ads.linkedin.com': 3,
      'snap.com': 3,
      'tiktok.com': 3,
      'byteoversea.com': 3,
    }
  );

  const NAME_PATTERNS = [
    { re: /^_ga/i, cat: 2 },
    { re: /^_gat/i, cat: 2 },
    { re: /^_gid/i, cat: 2 },
    { re: /^__utm/i, cat: 2 },
    { re: /^_ym_/i, cat: 2 },
    { re: /^_hj/i, cat: 2 },
    { re: /^_cl[a-z]/i, cat: 2 },
    { re: /^_fbp/i, cat: 3 },
    { re: /^_fbc/i, cat: 3 },
    { re: /^_gcl_/i, cat: 3 },
    { re: /^_tt_/i, cat: 3 },
    { re: /^_pin_/i, cat: 3 },
    { re: /^_uet/i, cat: 3 },
    { re: /^ajs_/i, cat: 2 },
    { re: /^mp_.*mixpanel/i, cat: 2 },
    { re: /^amplitude/i, cat: 2 },
    { re: /track/i, cat: 2 },
    { re: /^ads?[_-]/i, cat: 3 },
    { re: /^__gads/i, cat: 3 },
    { re: /^__gpi/i, cat: 3 },
    { re: /session|csrf|xsrf|token|auth|login|jwt|sid$/i, cat: 0 },
    { re: /^lang|locale|i18n|theme|dark|prefs?$/i, cat: 1 },
    { re: /consent|gdpr|ccpa|optanon/i, cat: 0 },

    { re: /^sentry/i, cat: 2 },
    { re: /^_lr_/i, cat: 2 },
    { re: /^logrocket/i, cat: 2 },
    { re: /^bugsnag/i, cat: 2 },
    { re: /^rollbar/i, cat: 2 },
    { re: /^raygun/i, cat: 2 },
    { re: /^trackjs/i, cat: 2 },
    { re: /^honeybadger/i, cat: 2 },
    { re: /^airbrake/i, cat: 2 },
  ];

  function classifyCookie(name, domain) {
    if (KNOWN_NAMES.hasOwnProperty(name)) return KNOWN_NAMES[name];

    for (const [pattern, cat] of Object.entries(KNOWN_NAMES)) {
      if (pattern.includes('*')) {
        const re = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$', 'i');
        if (re.test(name)) return cat;
      }
    }

    const cleanDomain = (domain || '').replace(/^\./, '').toLowerCase();
    for (const [td, cat] of Object.entries(TRACKER_DOMAINS)) {
      if (cleanDomain === td || cleanDomain.endsWith('.' + td)) return cat;
    }

    for (const p of NAME_PATTERNS) {
      if (p.re.test(name)) return p.cat;
    }

    if (name.length > 30) return 2;

    return 1;
  }

  const originalCookieDescriptor =
    Object.getOwnPropertyDescriptor(Document.prototype, 'cookie') ||
    Object.getOwnPropertyDescriptor(HTMLDocument.prototype, 'cookie');

  let cookiePolicy = null;
  let blockingEnabled = false;
  let blockedCount = { 0: 0, 1: 0, 2: 0, 3: 0 };
  let allowedCount = { 0: 0, 1: 0, 2: 0, 3: 0 };

  function shouldBlock(name, domain) {
    if (!blockingEnabled || !cookiePolicy) return false;
    const cat = classifyCookie(name, domain);
    if (cat === CAT_NECESSARY) return false;
    if (cat === CAT_FUNCTIONAL && cookiePolicy.functional) return false;
    if (cat === CAT_ANALYTICS && cookiePolicy.analytics) return false;
    if (cat === CAT_ADVERTISING && cookiePolicy.advertising) return false;

    if (cat === CAT_FUNCTIONAL && !cookiePolicy.functional) return true;
    if (cat === CAT_ANALYTICS && !cookiePolicy.analytics) return true;
    if (cat === CAT_ADVERTISING && !cookiePolicy.advertising) return true;
    return true;
  }

  function parseCookieName(cookieStr) {
    const eq = cookieStr.indexOf('=');
    return eq > 0 ? cookieStr.substring(0, eq).trim() : cookieStr.trim();
  }

  if (originalCookieDescriptor) {
    Object.defineProperty(document, 'cookie', {
      get: function () {
        return originalCookieDescriptor.get.call(this);
      },
      set: function (val) {
        const name = parseCookieName(val);
        const domain = location.hostname;
        const cat = classifyCookie(name, domain);
        if (shouldBlock(name, domain)) {
          blockedCount[cat] = (blockedCount[cat] || 0) + 1;
          return;
        }
        allowedCount[cat] = (allowedCount[cat] || 0) + 1;
        return originalCookieDescriptor.set.call(this, val);
      },
      configurable: true,
    });
  }

  const _api = typeof browser !== 'undefined' ? browser : chrome;

  async function loadCookieSettings() {
    try {
      const d = await _api.storage.local.get('eula_alert_settings');
      const s = d.eula_alert_settings || {};
      blockingEnabled = !!s.blockCookies;
      cookiePolicy = s.cookiePolicy || { functional: true, analytics: false, advertising: false };
    } catch {}
  }
  loadCookieSettings();

  _api.storage?.onChanged?.addListener((changes) => {
    if (changes.eula_alert_settings) loadCookieSettings();
  });

  const BANNER_SELECTORS = [
    '#cookie-banner',
    '#cookie-consent',
    '#cookie-notice',
    '#cookie-popup',
    '#cookie-bar',
    '#cookie-law',
    '#cookie-policy',
    '#cookiebanner',
    '#cookies-popup',
    '#gdpr-banner',
    '#gdpr-consent',
    '#cc-main',
    '#cookie-notification',
    '#cookie-overlay',
    '#cookie-modal',
    '#cookie_notice',
    '#cookie_bar',
    '#cookie_banner',
    '#cookie_popup',
    '#onetrust-consent-sdk',
    '#onetrust-banner-sdk',
    '#CybotCookiebotDialog',
    '#CybotCookiebotDialogBodyUnderlay',
    '#cookieConsentBanner',
    '#cookiePolicy',
    '#consent-banner',
    '#usercentrics-root',
    '#didomi-host',
    '#didomi-popup',
    '#cmpbox',
    '#cmpbox2',
    '#cmplz-cookiebanner-container',
    '#qc-cmp2-container',
    '#sp_message_container',

    '.cookie-banner',
    '.cookie-consent',
    '.cookie-notice',
    '.cookie-popup',
    '.cookie-bar',
    '.cookie-law',
    '.cookie-policy',
    '.cookie-message',
    '.cookies-popup',
    '.gdpr-banner',
    '.gdpr-consent',
    '.cc-banner',
    '.js-cookie-consent',
    '.cc-window',
    '.cc-dialog',
    '.cmp-container',
    '.cookie-overlay',
    '.cookie-modal',
    '.consent-banner',
    '.consent-modal',
    '.cookie-wall',
    '.cookie-notification',
    '.privacy-banner',
    '.cc-floating',
    '.cc-bottom',
    '.cc-top',
    '.cc-overlay',
    '.cookie-alert',
    '.cookie-info',
    '.cookie-warning',
    '.gdpr-popup',
    '.gdpr-notice',
    '.gdpr-modal',
    '.gdpr-bar',
    '.consent-popup',
    '.consent-notice',
    '.consent-overlay',

    '[class*="cookie-banner"]',
    '[class*="cookie-consent"]',
    '[class*="cookie-notice"]',
    '[class*="cookie-popup"]',
    '[class*="cookie-bar"]',
    '[class*="cookie-overlay"]',
    '[class*="cookieConsent"]',
    '[class*="CookieConsent"]',
    '[class*="cookieBanner"]',
    '[class*="cookie_banner"]',
    '[class*="cookie_notice"]',
    '[class*="cookie_consent"]',
    '[id*="cookie-consent"]',
    '[id*="cookie-banner"]',
    '[id*="cookie-notice"]',
    '[id*="cookieconsent"]',
    '[id*="cookiebanner"]',
    '[class*="gdpr"]',
    '[id*="gdpr"]',
    '[class*="consent-banner"]',
    '[class*="consent-popup"]',
    '[class*="privacy-banner"]',
    '[class*="privacy-popup"]',
    '[aria-label*="cookie" i]',
    '[aria-label*="consent" i]',
    '[aria-label*="gdpr" i]',
    '[aria-label*="privacy" i]',
    '[role="dialog"][class*="cookie" i]',
    '[role="dialog"][class*="consent" i]',
    '[role="alertdialog"][class*="cookie" i]',

    '.osano-cm-dialog',
    '.truste_box_overlay',
    '.truste_overlay',
    '.evidon-consent-button',
    '#evidon-banner',
    '.evidon-banner',
    '.iubenda-cs-container',
    '#iubenda-cs-banner',
    '.cli-modal',
    '.cli-bar-container',
    '#cookie-law-info-bar',
    '.eupopup-container',
    '#catapult-cookie-bar',
    '.pea_cook_wrapper',
    '#moove_gdpr_cookie_info_bar',
  ];

  const REJECT_TEXTS = [
    'отклонить',
    'отказаться',
    'не принимать',
    'отказать',
    'только необходимые',
    'только обязательные',
    'отклонить все',

    'reject',
    'decline',
    'deny',
    'refuse',
    'reject all',
    'decline all',
    'deny all',
    'necessary only',
    'essential only',
    'accept necessary',
    'only necessary',
    'only essential',
    'manage',
    'no thanks',
    'no, thanks',
    'i disagree',
    'disagree',
    'opt out',
    'opt-out',

    'ablehnen',
    'nur notwendige',
    'nur erforderliche',
    'alle ablehnen',
    'nicht zustimmen',
    'nur essenzielle',

    'refuser',
    'tout refuser',
    'refuser tout',
    'continuer sans accepter',
    'accepter les necessaires',
    'necessaires uniquement',

    'rechazar',
    'rechazar todo',
    'rechazar todas',
    'solo necesarias',
    'solo esenciales',

    'rejeitar',
    'recusar',
    'rejeitar tudo',
    'apenas necessarios',

    'rifiuta',
    'rifiuta tutto',
    'rifiuta tutti',
    'solo necessari',

    'reddet',
    'tümünü reddet',
    'sadece gerekli',

    'odrzuć',
    'odrzuc',
    'odrzuć wszystkie',
    'tylko niezbędne',

    'відхилити',
    'лише необхідні',

    '拒否',
    'すべて拒否',

    '拒绝',
    '全部拒绝',
    '仅必要',
  ];

  function hideBanner(el) {
    el.style.setProperty('display', 'none', 'important');
    el.style.setProperty('visibility', 'hidden', 'important');
    el.style.setProperty('display', 'none', 'important');
    el.style.setProperty('visibility', 'hidden', 'important');
    el.style.setProperty('opacity', '0', 'important');
    el.style.setProperty('pointer-events', 'none', 'important');
    el.style.setProperty('max-height', '0', 'important');
    el.style.setProperty('overflow', 'hidden', 'important');
    el.style.setProperty('position', 'absolute', 'important');
    el.style.setProperty('top', '-9999px', 'important');
    el.style.setProperty('z-index', '-1', 'important');
  }

  function hideBanners() {
    const sel = BANNER_SELECTORS.join(',');
    document.querySelectorAll(sel).forEach(hideBanner);

    document.querySelectorAll('[class*="overlay"], [class*="backdrop"]').forEach((el) => {
      const cls = (el.className || '').toLowerCase();
      if (
        cls.includes('cookie') ||
        cls.includes('consent') ||
        cls.includes('gdpr') ||
        cls.includes('privacy')
      ) {
        hideBanner(el);
      }
    });

    document.body.style.removeProperty('overflow');
    document.documentElement.style.removeProperty('overflow');
    document.body.classList.remove('no-scroll', 'modal-open', 'cookie-open', 'has-overlay');
  }

  function tryRejectCookies() {
    const containers = [...document.querySelectorAll(BANNER_SELECTORS.join(','))];
    const searchIn = containers.length ? containers : [document];
    let clicked = false;

    for (const container of searchIn) {
      const btns = container.querySelectorAll(
        'button, a[role="button"], [class*="btn"], [class*="button"], input[type="button"], input[type="submit"], span[role="button"], div[role="button"]'
      );
      for (const btn of btns) {
        const text = (btn.textContent || btn.value || '').trim().toLowerCase();
        if (text.length > 80) continue;
        for (const rt of REJECT_TEXTS) {
          if (text === rt || text.includes(rt)) {
            try {
              btn.click();
            } catch {}
            clicked = true;
            break;
          }
        }
        if (clicked) break;
      }
      if (clicked) break;
    }

    if (!clicked) {
      const otReject = document.getElementById('onetrust-reject-all-handler');
      if (otReject) {
        otReject.click();
        clicked = true;
      }

      const cbDecline = document.getElementById('CybotCookiebotDialogBodyButtonDecline');
      if (!clicked && cbDecline) {
        cbDecline.click();
        clicked = true;
      }

      const didomi = document.querySelector(
        '[id*="didomi"] button.didomi-dismiss-button, .didomi-continue-without-agreeing'
      );
      if (!clicked && didomi) {
        didomi.click();
        clicked = true;
      }

      const qcReject = document.querySelector(
        '.qc-cmp2-summary-buttons button[mode="secondary"], .qc-cmp-button[onclick*="reject"]'
      );
      if (!clicked && qcReject) {
        qcReject.click();
        clicked = true;
      }

      const ucDeny = document
        .querySelector('#usercentrics-root')
        ?.shadowRoot?.querySelector('button[data-testid="uc-deny-all-button"]');
      if (!clicked && ucDeny) {
        ucDeny.click();
        clicked = true;
      }
    }

    return clicked;
  }

  function blockCookiesUI() {
    function attempt() {
      if (!tryRejectCookies()) hideBanners();
      else setTimeout(hideBanners, 300);
    }

    attempt();
    setTimeout(attempt, 200);
    setTimeout(attempt, 500);
    setTimeout(attempt, 1000);
    setTimeout(attempt, 1500);
    setTimeout(attempt, 3000);
    setTimeout(attempt, 5000);
    setTimeout(attempt, 8000);

    const bannerObserver = new MutationObserver(() => {
      const banners = document.querySelectorAll(BANNER_SELECTORS.join(','));
      if (banners.length > 0) {
        setTimeout(attempt, 100);
      }
    });
    bannerObserver.observe(document.documentElement, { childList: true, subtree: true });

    setTimeout(() => bannerObserver.disconnect(), 30000);
  }

  const TRACKER_SCRIPT_DOMAINS = [
    'google-analytics.com',
    'googletagmanager.com',
    'analytics.google.com',
    'mc.yandex.ru',
    'metrika.yandex.ru',
    'connect.facebook.net',
    'facebook.net',
    'hotjar.com',
    'static.hotjar.com',
    'clarity.ms',
    'mouseflow.com',
    'fullstory.com',
    'cdn.segment.com',
    'api.segment.io',
    'cdn.mxpnl.com',
    'cdn.amplitude.com',
    'bat.bing.com',
    'ads.linkedin.com',
    'snap.licdn.com',
    'analytics.tiktok.com',
    'sc-static.net',

    'sentry.io',
    'sentry-cdn.com',
    'browser.sentry-cdn.com',
    'getsentry.net',
    'ingest.sentry.io',
    'bugsnag.com',
    'd2wy8f7a9ursnm.cloudfront.net',
    'rollbar.com',
    'api.rollbar.com',
    'trackjs.com',
    'usage.trackjs.com',
    'raygun.com',
    'raygun.io',
    'airbrake.io',
    'api.airbrake.io',
    'exceptionless.com',
    'honeybadger.io',
    'js.honeybadger.io',
    'atatus.com',
    'api.atatus.com',
    'logrocket.io',
    'cdn.logrocket.io',
    'cdn.logrocket.com',
    'r.lr-in.com',
    'r.lr-ingest.io',
    'errlytic.com',
    'catchjs.com',
    'doubleclick.net',
    'googlesyndication.com',
    'adservice.google.com',
    'pagead2.googlesyndication.com',
    'criteo.com',
    'criteo.net',
    'taboola.com',
    'cdn.taboola.com',
    'outbrain.com',
    'widgets.outbrain.com',
    'adnxs.com',
    'adsrvr.org',
    'rubiconproject.com',
  ];

  function blockTrackers() {
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.tagName === 'SCRIPT' && node.src) {
            const src = node.src.toLowerCase();
            for (const td of TRACKER_SCRIPT_DOMAINS) {
              if (src.includes(td)) {
                node.remove();
                break;
              }
            }
          }
          if (node.tagName === 'IFRAME' && node.src) {
            const src = node.src.toLowerCase();
            for (const td of TRACKER_SCRIPT_DOMAINS) {
              if (src.includes(td)) {
                node.remove();
                break;
              }
            }
          }
        }
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  async function init() {
    await loadCookieSettings();
    const d = await _api.storage.local.get('eula_alert_settings');
    const s = d.eula_alert_settings || {};

    if (s.blockCookies !== false) blockCookiesUI();
    if (s.antiTracker) blockTrackers();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);

    try {
      hideBanners();
    } catch {}
  } else {
    init();
  }

  _api.runtime?.onMessage?.addListener((msg) => {
    if (msg.type === 'run_cookie_block') {
      blockCookiesUI();
      blockTrackers();
    }
  });

  const ERROR_TRACKER_DOMAINS = [
    'sentry.io',
    'sentry-cdn.com',
    'browser.sentry-cdn.com',
    'getsentry.net',
    'ingest.sentry.io',
    'bugsnag.com',
    'd2wy8f7a9ursnm.cloudfront.net',
    'rollbar.com',
    'api.rollbar.com',
    'trackjs.com',
    'usage.trackjs.com',
    'raygun.com',
    'raygun.io',
    'airbrake.io',
    'api.airbrake.io',
    'exceptionless.com',
    'honeybadger.io',
    'js.honeybadger.io',
    'atatus.com',
    'api.atatus.com',
    'logrocket.io',
    'cdn.logrocket.io',
    'cdn.logrocket.com',
    'r.lr-in.com',
    'r.lr-ingest.io',
    'errlytic.com',
    'catchjs.com',
    'muscula.com',
    'errorception.com',
    'jslog.com',
    'debugbear.com',
  ];

  let errorTrackersBlocked = 0;

  function blockErrorTrackers() {
    try {
      if (window.Sentry) {
        window.Sentry = {
          init() {},
          captureException() {},
          captureMessage() {},
          withScope() {},
          configureScope() {},
          setUser() {},
          setTag() {},
          setExtra() {},
          addBreadcrumb() {},
        };
        errorTrackersBlocked++;
      }
      if (window.Bugsnag) {
        window.Bugsnag = { start() {}, notify() {}, leaveBreadcrumb() {} };
        errorTrackersBlocked++;
      }
      if (window.Rollbar) {
        window.Rollbar = {
          init() {},
          error() {},
          warning() {},
          info() {},
          critical() {},
          configure() {},
        };
        errorTrackersBlocked++;
      }
      if (window.TrackJS) {
        window.TrackJS = { install() {}, track() {}, configure() {}, addMetadata() {} };
        errorTrackersBlocked++;
      }
      if (window.rg4js) {
        window.rg4js = function () {};
        errorTrackersBlocked++;
      }
      if (window.Honeybadger) {
        window.Honeybadger = { configure() {}, notify() {}, setContext() {} };
        errorTrackersBlocked++;
      }
      if (window.LogRocket) {
        window.LogRocket = {
          init() {},
          identify() {},
          track() {},
          captureException() {},
          getSessionURL() {},
          startNewSession() {},
        };
        errorTrackersBlocked++;
      }
      if (window.atatus) {
        window.atatus = { config() {}, notify() {}, setUser() {} };
        errorTrackersBlocked++;
      }
    } catch {}

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (!node.tagName) continue;
          if ((node.tagName === 'SCRIPT' || node.tagName === 'IFRAME') && node.src) {
            const src = node.src.toLowerCase();
            for (const ed of ERROR_TRACKER_DOMAINS) {
              if (src.includes(ed)) {
                node.remove();
                errorTrackersBlocked++;
                break;
              }
            }
          }
        }
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });

    document.querySelectorAll('script[src], iframe[src]').forEach((el) => {
      const src = (el.src || '').toLowerCase();
      for (const ed of ERROR_TRACKER_DOMAINS) {
        if (src.includes(ed)) {
          el.remove();
          errorTrackersBlocked++;
          break;
        }
      }
    });

    const origBeacon = navigator.sendBeacon?.bind(navigator);
    if (origBeacon) {
      navigator.sendBeacon = function (url, data) {
        const u = (url || '').toLowerCase();
        for (const ed of ERROR_TRACKER_DOMAINS) {
          if (u.includes(ed)) {
            errorTrackersBlocked++;
            return true;
          }
        }
        return origBeacon(url, data);
      };
    }
  }

  async function initErrorTrackerBlock() {
    const d = await _api.storage.local.get('eula_alert_settings');
    if ((d.eula_alert_settings || {}).blockErrorTrackers) blockErrorTrackers();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initErrorTrackerBlock);
  } else {
    initErrorTrackerBlock();
  }

  const SOCIAL_WIDGET_DOMAINS = [
    'facebook.com',
    'facebook.net',
    'fbcdn.net',
    'connect.facebook.net',

    'platform.twitter.com',
    'syndication.twitter.com',
    'x.com',

    'vk.com',
    'vkontakte.ru',
    'userapi.com',

    'platform.linkedin.com',
    'badges.linkedin.com',

    'assets.pinterest.com',
    'widgets.pinterest.com',

    'instagram.com',
    'cdninstagram.com',

    'tiktok.com',
    'lf16-tiktok-web.ttwstatic.com',

    'embed.reddit.com',
    'www.redditstatic.com',

    'telegram.org',
    't.me',

    'ok.ru',
    'odnoklassniki.ru',

    'assets.tumblr.com',

    'addthis.com',
    'addthisedge.com',
    'sharethis.com',

    'disqus.com',
    'disquscdn.com',
  ];

  const SOCIAL_SELECTORS = [
    '.fb-like',
    '.fb-share-button',
    '.fb-comments',
    '.fb-page',
    '.fb-group',
    '.fb-send',
    '.fb-follow',
    '.fb-login-button',
    '.fb-save',
    'div[class*="fb-"]',
    'iframe[src*="facebook.com/plugins"]',
    'iframe[src*="facebook.com/v"]',

    '.twitter-share-button',
    '.twitter-follow-button',
    '.twitter-timeline',
    '.twitter-tweet',
    'iframe[src*="platform.twitter.com"]',
    'iframe[src*="syndication.twitter.com"]',

    '#vk_like',
    '#vk_share',
    '#vk_comments',
    '#vk_subscribe',
    'div[id^="vk_"]',
    'iframe[src*="vk.com/widget"]',

    'iframe[src*="platform.linkedin.com"]',
    'script[src*="platform.linkedin.com"]',

    'a[data-pin-do]',
    'iframe[src*="pinterest.com"]',

    'iframe[src*="instagram.com/embed"]',

    '.addthis_toolbox',
    '.addthis_button',
    '.addthis_sharing_toolbox',
    'div[class*="addthis"]',

    '.sharethis-inline-share-buttons',
    'div[class*="sharethis"]',

    '#disqus_thread',
    'iframe[src*="disqus.com"]',

    '.social-share',
    '.share-buttons',
    '.social-buttons',
    '[class*="social-share"]',
    '[class*="share-button"]',
    'iframe[src*="ok.ru/widget"]',
    'iframe[src*="t.me"]',
  ];

  let socialBlockedCount = 0;

  function blockSocialWidgets() {
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (!node.tagName) continue;
          if (node.tagName === 'SCRIPT' && node.src) {
            const src = node.src.toLowerCase();
            for (const sd of SOCIAL_WIDGET_DOMAINS) {
              if (src.includes(sd)) {
                node.remove();
                socialBlockedCount++;
                break;
              }
            }
          }
          if (node.tagName === 'IFRAME' && node.src) {
            const src = node.src.toLowerCase();
            for (const sd of SOCIAL_WIDGET_DOMAINS) {
              if (src.includes(sd)) {
                node.remove();
                socialBlockedCount++;
                break;
              }
            }
          }
        }
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });

    function removeSocialElements() {
      const sel = SOCIAL_SELECTORS.join(',');
      try {
        document.querySelectorAll(sel).forEach((el) => {
          el.remove();
          socialBlockedCount++;
        });
      } catch {}

      document.querySelectorAll('script[src], iframe[src]').forEach((el) => {
        const src = (el.src || '').toLowerCase();
        for (const sd of SOCIAL_WIDGET_DOMAINS) {
          if (src.includes(sd)) {
            el.remove();
            socialBlockedCount++;
            break;
          }
        }
      });

      document.querySelectorAll('a[href*="share"], a[href*="sharer"]').forEach((el) => {
        const href = (el.href || '').toLowerCase();
        if (
          href.includes('facebook.com/sharer') ||
          href.includes('twitter.com/intent') ||
          href.includes('vk.com/share') ||
          href.includes('pinterest.com/pin') ||
          href.includes('linkedin.com/sharing') ||
          href.includes('t.me/share') ||
          href.includes('ok.ru/dk') ||
          href.includes('reddit.com/submit') ||
          href.includes('tumblr.com/share') ||
          href.includes('x.com/intent')
        ) {
          el.style.setProperty('display', 'none', 'important');
          socialBlockedCount++;
        }
      });
    }

    removeSocialElements();
    setTimeout(removeSocialElements, 1000);
    setTimeout(removeSocialElements, 3000);
  }

  async function initSocialBlock() {
    const d = await _api.storage.local.get('eula_alert_settings');
    if ((d.eula_alert_settings || {}).blockSocial) blockSocialWidgets();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSocialBlock);
  } else {
    initSocialBlock();
  }

  _api.runtime?.onMessage?.addListener((msg) => {
    if (msg.type === 'run_social_block') {
      blockSocialWidgets();
    }
  });

  let formWarningsShown = 0;

  function checkFormSecurity() {
    const currentHost = location.hostname.replace(/^www\./, '').toLowerCase();
    function scanForms() {
      const forms = document.querySelectorAll('form');
      for (const form of forms) {
        if (form.dataset.eulaFormChecked) continue;
        form.dataset.eulaFormChecked = '1';
        const hasPwd = form.querySelector('input[type="password"]');
        const hasLogin = form.querySelector(
          'input[type="email"], input[name*="login" i], input[name*="user" i], input[name*="email" i], input[autocomplete="username"], input[autocomplete="email"]'
        );
        if (!hasPwd && !hasLogin) continue;
        const action = form.getAttribute('action');
        if (
          !action ||
          action === '' ||
          action === '#' ||
          action.startsWith('javascript:') ||
          action.startsWith('/') ||
          !action.includes('//')
        )
          continue;
        try {
          const actionUrl = new URL(action, location.href);
          const actionHost = actionUrl.hostname.replace(/^www\./, '').toLowerCase();
          if (actionHost !== currentHost) {
            showFormWarning(form, actionHost);
          }
        } catch {}
      }
    }
    function showFormWarning(form, foreignHost) {
      formWarningsShown++;
      const warn = document.createElement('div');
      warn.style.cssText =
        'background:#fef2f2;border:2px solid #ef4444;border-radius:8px;padding:10px 14px;margin-bottom:10px;font-size:13px;color:#991b1b;font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;align-items:center;gap:8px';
      warn.innerHTML =
        '<span>Эта форма отправляет данные на другой домен: <b>' +
        foreignHost +
        '</b>. Будьте осторожны!</span>';
      form.style.position = form.style.position || 'relative';
      form.insertBefore(warn, form.firstChild);
    }
    scanForms();
    setTimeout(scanForms, 1500);
    setTimeout(scanForms, 4000);
    const fObs = new MutationObserver(() => scanForms());
    fObs.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => fObs.disconnect(), 30000);
  }

  async function initFormSecurity() {
    const d = await _api.storage.local.get('eula_alert_settings');
    if ((d.eula_alert_settings || {}).formSecurity !== false) checkFormSecurity();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFormSecurity);
  } else {
    initFormSecurity();
  }

  const MINER_DOMAINS = [
    'coinhive.com',
    'coin-hive.com',
    'authedmine.com',
    'crypto-loot.com',
    'cryptoloot.pro',
    'coin-have.com',
    'ppoi.org',
    'coinimp.com',
    'jsecoin.com',
    'load.jsecoin.com',
    'monerominer.rocks',
    'webmine.cz',
    'minero.cc',
    'webminepool.com',
    'mineralt.io',
    'hashforcash.us',
    'kindafast.com',
    'browsermine.com',
    'cryptonight-asmjs.min.js',
    'webminerpool.com',
    'coinerra.com',
    'papoto.com',
    'rocks.io',
  ];

  const MINER_CODE_PATTERNS = [
    /CoinHive\.Anonymous/i,
    /CoinHive\.Token/i,
    /new\s+CoinHive/i,
    /CRLT\.Anonymous/i,
    /CryptoLoot/i,
    /CoinImp\.Anonymous/i,
    /deepMiner/i,
    /startMining\s*\(/i,
    /wasmMiner/i,
    /cryptonight/i,
    /monerominer/i,
    /BrowserMiner/i,
    /Client\.Anonymous\s*\(/i,
    /minero\.cc/i,
    /webminepool/i,
  ];

  const MINER_WS_PATTERNS = [
    /stratum/i,
    /pool.*miner/i,
    /xmr.*pool/i,
    /monero.*pool/i,
    /mining.*proxy/i,
  ];

  let minersBlocked = 0;

  function scanCryptoMiners() {
    function checkScript(node) {
      if (node.src) {
        const src = node.src.toLowerCase();
        for (const d of MINER_DOMAINS) {
          if (src.includes(d)) {
            node.remove();
            minersBlocked++;
            return true;
          }
        }
      }
      if (!node.src && node.textContent) {
        const code = node.textContent;
        for (const p of MINER_CODE_PATTERNS) {
          if (p.test(code)) {
            node.textContent = '/* blocked by MiniShield: cryptominer */';
            minersBlocked++;
            return true;
          }
        }
      }
      return false;
    }

    document.querySelectorAll('script').forEach(checkScript);

    const mObs = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.tagName === 'SCRIPT') checkScript(node);
          if (node.tagName === 'IFRAME' && node.src) {
            const src = node.src.toLowerCase();
            for (const d of MINER_DOMAINS) {
              if (src.includes(d)) {
                node.remove();
                minersBlocked++;
                break;
              }
            }
          }
        }
      }
    });
    mObs.observe(document.documentElement, { childList: true, subtree: true });

    try {
      const OrigWS = window.WebSocket;
      window.WebSocket = function (url, protocols) {
        const u = (url || '').toLowerCase();
        for (const d of MINER_DOMAINS) {
          if (u.includes(d)) {
            minersBlocked++;
            return {
              close() {},
              send() {},
              addEventListener() {},
              removeEventListener() {},
              set onmessage(v) {},
              set onerror(v) {},
              set onopen(v) {},
              set onclose(v) {},
              readyState: 3,
              CLOSED: 3,
            };
          }
        }
        for (const p of MINER_WS_PATTERNS) {
          if (p.test(u)) {
            minersBlocked++;
            return {
              close() {},
              send() {},
              addEventListener() {},
              removeEventListener() {},
              set onmessage(v) {},
              set onerror(v) {},
              set onopen(v) {},
              set onclose(v) {},
              readyState: 3,
              CLOSED: 3,
            };
          }
        }
        if (protocols) return new OrigWS(url, protocols);
        return new OrigWS(url);
      };
      window.WebSocket.prototype = OrigWS.prototype;
      window.WebSocket.CONNECTING = 0;
      window.WebSocket.OPEN = 1;
      window.WebSocket.CLOSING = 2;
      window.WebSocket.CLOSED = 3;
    } catch {}
  }

  async function initCryptoMinerBlock() {
    const d = await _api.storage.local.get('eula_alert_settings');
    if ((d.eula_alert_settings || {}).blockCryptoMiners !== false) scanCryptoMiners();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCryptoMinerBlock);
  } else {
    initCryptoMinerBlock();
  }

  let hiddenIframesFound = 0;
  function scanHiddenIframes() {
    if (!settings.detectHiddenIframes) return;
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach((iframe) => {
      if (iframe.dataset.eulaChecked) return;
      iframe.dataset.eulaChecked = '1';
      const st = getComputedStyle(iframe);
      const rect = iframe.getBoundingClientRect();
      const isHidden =
        st.display === 'none' ||
        st.visibility === 'hidden' ||
        st.opacity === '0' ||
        (rect.width <= 1 && rect.height <= 1) ||
        rect.width === 0 ||
        rect.height === 0 ||
        parseInt(st.left) < -999 ||
        parseInt(st.top) < -999;
      if (!isHidden) return;
      const src = iframe.src || iframe.getAttribute('srcdoc') || '';

      const WHITELIST = [
        'recaptcha',
        'google.com/recaptcha',
        'gstatic.com',
        'stripe.com',
        'paypal.com',
        'facebook.com/plugins',
        'platform.twitter.com',
        'youtube.com/embed',
        'doubleclick.net',
      ];
      if (src && WHITELIST.some((w) => src.includes(w))) return;
      hiddenIframesFound++;
      iframe.remove();
      console.warn('[MiniShield] Скрытый iframe удален:', src || '(inline)');
    });
    if (hiddenIframesFound > 0)
      showSecurityWarning(
        'iframe',
        `Обнаружено и удалено скрытых iframe: ${hiddenIframesFound}. Такие элементы могут использоваться для clickjacking или скрытой загрузки вредоносного кода.`
      );
  }

  let obfuscatedScriptsFound = 0;
  const OBFUSC_PATTERNS = [
    /eval\s*\(\s*atob\s*\(/i,
    /eval\s*\(\s*unescape\s*\(/i,
    /eval\s*\(\s*String\.fromCharCode/i,
    /eval\s*\(\s*function\s*\(\s*\)\s*\{/i,
    /document\.write\s*\(\s*unescape\s*\(/i,
    /document\.write\s*\(\s*atob\s*\(/i,
    /\bFunction\s*\(\s*['"]return\s/i,
    /new\s+Function\s*\(\s*atob/i,
    /\bwindow\[['"]\\x/i,
    /\\x[0-9a-f]{2}\\x[0-9a-f]{2}\\x[0-9a-f]{2}/i,
    /\\u00[0-9a-f]{2}\\u00[0-9a-f]{2}\\u00[0-9a-f]{2}/i,
    /charAt\s*\(\s*parseInt/i,
    /fromCharCode\.apply\s*\(\s*null/i,
    /\['\\x/,
    /\(\s*['"][A-Za-z0-9+/=]{100,}['"]\s*\)/,
  ];
  function scanObfuscatedJS() {
    if (!settings.detectObfuscatedJS) return;
    const scripts = document.querySelectorAll('script:not([src])');
    scripts.forEach((script) => {
      if (script.dataset.eulaObfCheck) return;
      script.dataset.eulaObfCheck = '1';
      const code = script.textContent || '';
      if (code.length < 20) return;
      const matched = OBFUSC_PATTERNS.filter((p) => p.test(code));
      if (matched.length >= 1) {
        obfuscatedScriptsFound++;
        console.warn('[MiniShield] Подозрительный obfuscated скрипт:', code.substring(0, 120));
      }
    });
    if (obfuscatedScriptsFound > 0)
      showSecurityWarning(
        'obfuscated',
        `Обнаружено подозрительных обфусцированных скриптов: ${obfuscatedScriptsFound}. Закодированный JS (eval/atob) часто является признаком внедренного вредоносного кода.`
      );
  }

  /* ========== Детект провокации установки расширений ========== */
  let extInstallPrompts = 0;
  const EXT_INSTALL_PATTERNS = [
    /chrome\.google\.com\/webstore/i,
    /addons\.mozilla\.org/i,
    /microsoftedge\.microsoft\.com\/addons/i,
    /install.*extension/i,
    /установ.*расширен/i,
    /add.*to.*chrome/i,
    /добав.*в.*chrome/i,
    /install.*plugin/i,
    /download.*extension/i,
    /browser.*addon/i,
    /chrome\.webstore\.install/i,
  ];
  function scanExtInstallProvocation() {
    if (!settings.detectExtInstall) return;
    /* Проверяем ссылки, ведущие к установке расширений */
    const links = document.querySelectorAll('a[href], button, [onclick]');
    links.forEach((el) => {
      if (el.dataset.eulaExtCheck) return;
      el.dataset.eulaExtCheck = '1';
      const href = el.href || el.getAttribute('onclick') || '';
      const text = (el.textContent || '').toLowerCase();
      const combined = href + ' ' + text;
      if (EXT_INSTALL_PATTERNS.some((p) => p.test(combined))) {
        /* Пропускаем если мы уже на странице магазина расширений */
        const loc = location.hostname;
        if (
          loc.includes('chrome.google.com') ||
          loc.includes('addons.mozilla.org') ||
          loc.includes('microsoftedge.microsoft.com')
        )
          return;
        extInstallPrompts++;
      }
    });
    /* Также проверяем inline JS вызовы chrome.webstore.install */
    const scripts = document.querySelectorAll('script:not([src])');
    scripts.forEach((s) => {
      if (s.dataset.eulaExtScriptCheck) return;
      s.dataset.eulaExtScriptCheck = '1';
      if (/chrome\.webstore\.install|browser\.downloads\.download/i.test(s.textContent || ''))
        extInstallPrompts++;
    });
    if (extInstallPrompts > 0)
      showSecurityWarning(
        'ext-install',
        `Эта страница пытается спровоцировать установку расширения браузера (${extInstallPrompts} элементов). Будьте осторожны!`
      );
  }

  /* Общий баннер предупреждения безопасности */
  function showSecurityWarning(type, message) {
    if (document.getElementById('eula-sec-warn-' + type)) return;
    const banner = document.createElement('div');
    banner.id = 'eula-sec-warn-' + type;
    banner.style.cssText =
      'position:fixed;top:0;left:0;right:0;z-index:2147483646;background:#fef2f2;border-bottom:2px solid #fca5a5;resize:none;padding:10px 16px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:13px;color:#991b1b;display:flex;align-items:center;gap:10px;animation:eula-slide-down .3s ease';
    banner.innerHTML =
      '<span style="flex:1">' +
      message +
      '</span><button style="background:none;border:none;font-size:18px;cursor:pointer;color:#991b1b" onclick="this.parentElement.remove()"></button>';
    document.body.appendChild(banner);
  }

  function initNewScanners() {
    scanHiddenIframes();
    scanObfuscatedJS();
    scanExtInstallProvocation();

    const secObs = new MutationObserver(() => {
      scanHiddenIframes();
      scanObfuscatedJS();
      scanExtInstallProvocation();
    });
    secObs.observe(document.documentElement, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNewScanners);
  } else {
    initNewScanners();
  }

  window.__eula_cookie_classify = classifyCookie;
  window.__eula_cookie_stats = () => ({
    blocked: { ...blockedCount },
    allowed: { ...allowedCount },
    socialBlocked: socialBlockedCount,
    errorTrackersBlocked,
    formWarnings: formWarningsShown,
    minersBlocked,
    hiddenIframesFound,
    obfuscatedScriptsFound,
    extInstallPrompts,
  });

  window.__eula_cookie_blocker_loaded = true;
  window.CookieBlocker = {
    init: init,
    getStats: () => {
      const totalBlocked = Object.values(blockedCount).reduce((a, b) => a + b, 0);
      return {
        blockedTrackers: totalBlocked + socialBlockedCount + errorTrackersBlocked,
        cookieBannerHandled: totalBlocked > 0 || socialBlockedCount > 0,
        socialBlocked: socialBlockedCount,
        errorTrackersBlocked: errorTrackersBlocked,
        formWarnings: formWarningsShown,
        minersBlocked: minersBlocked,
      };
    },
    hideCookieBanners: blockCookiesUI,
    blockSocial: blockSocialWidgets,
    checkForms: checkFormSecurity,
    scanMiners: scanCryptoMiners,
    scanIframes: scanHiddenIframes,
    scanObfuscated: scanObfuscatedJS,
    scanExtInstall: scanExtInstallProvocation,
  };
})();
