
if (!window.EulaAlertStorage) {
  window.EulaAlertStorage = (() => {
    const api = typeof browser !== 'undefined' ? browser : chrome;
    const PROFILE_KEY  = 'eula_alert_profile';
    const SETTINGS_KEY = 'eula_alert_settings';
    const HISTORY_KEY  = 'eula_alert_history';

    async function getProfile() {
      const d = await api.storage.local.get(PROFILE_KEY);
      return d[PROFILE_KEY] || {};
    }
    async function saveProfile(p) {
      await api.storage.local.set({ [PROFILE_KEY]: p });
    }
    async function getSettings() {
      const d = await api.storage.local.get(SETTINGS_KEY);
      return Object.assign({
        autoScan: true, autoFill: false, language: 'ru',
        riskLevel: 'all', showBadge: true, useAI: true,
        blockCookies: true, antiTracker: false, notifications: false,
        safeBrowsing: true, geminiApiKey: '', safeBrowsingApiKey: ''
      }, d[SETTINGS_KEY] || {});
    }
    async function saveSettings(s) {
      await api.storage.local.set({ [SETTINGS_KEY]: s });
    }
    async function getHistory() {
      const d = await api.storage.local.get(HISTORY_KEY);
      return d[HISTORY_KEY] || [];
    }
    async function addHistoryEntry(entry) {
      const h = await getHistory();
      h.unshift({ ...entry, date: Date.now() });
      if (h.length > 100) h.length = 100;
      await api.storage.local.set({ [HISTORY_KEY]: h });
    }
    return { getProfile, saveProfile, getSettings, saveSettings, getHistory, addHistoryEntry };
  })();
}
