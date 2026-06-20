(function () {
  const api = typeof browser !== 'undefined' ? browser : chrome;

  function t(key, fallback) {
    try {
      const msg = api.i18n.getMessage(key);
      return msg || fallback || key;
    } catch {
      return fallback || key;
    }
  }

  function translatePage() {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      const msg = t(key, el.textContent);
      if (msg) el.textContent = msg;
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      const msg = t(key, el.placeholder);
      if (msg) el.placeholder = msg;
    });

    document.querySelectorAll('[data-i18n-title]').forEach((el) => {
      const key = el.getAttribute('data-i18n-title');
      const msg = t(key, el.title);
      if (msg) el.title = msg;
    });

    document.querySelectorAll('[data-i18n-html]').forEach((el) => {
      const key = el.getAttribute('data-i18n-html');
      const msg = t(key, el.innerHTML);
      if (msg) el.innerHTML = msg;
    });

    const titleKey = document.documentElement.getAttribute('data-i18n-title');
    if (titleKey) document.title = t(titleKey, document.title);
  }

  window.__i18n = t;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', translatePage);
  } else {
    translatePage();
  }
})();
