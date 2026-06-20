if (!window.TosAnalyzer) {
  window.TosAnalyzer = (() => {
    const api = typeof browser !== 'undefined' ? browser : chrome;

    const TOS_LINK_PATTERNS = [
      /terms\s*(of\s*(service|use)|&\s*conditions)/i,
      /user\s*agreement/i,
      /privacy\s*policy/i,
      /cookie\s*policy/i,
      /EULA/i,
      /legal\s*(notice|terms)/i,
      /acceptable\s*use/i,
      /пользовательское\s*соглашение/i,
      /политика\s*конфиденциальности/i,
      /условия\s*(использования|обслуживания|предоставления)/i,
      /лицензионное\s*соглашение/i,
      /правила\s*сервиса/i,
      /обработк\w+\s*данных/i,
    ];

    const RISK_PATTERNS = [
      {
        id: 'auto_renew',
        label: 'Автопродление',
        icon: '🔄',
        severity: 'high',
        patterns: [
          /auto.?renew/i,
          /automatically\s*renew/i,
          /автопродлен/i,
          /автоматическ\w+\s*продлен/i,
        ],
      },
      {
        id: 'data_sale',
        label: 'Продажа данных',
        icon: '💰',
        severity: 'critical',
        patterns: [
          /sell\s*(your)?\s*data/i,
          /share.*(personal|data).*(third|partner|advertis)/i,
          /продаж\w+\s*данн/i,
          /передач\w+\s*данн\w+\s*трет/i,
          /рекламн\w+\s*партнер/i,
        ],
      },
      {
        id: 'deletion',
        label: 'Сложное удаление',
        icon: '🗑️',
        severity: 'high',
        patterns: [
          /cannot\s*(be\s*)?delete/i,
          /retain.*(data|info).*(after|indefinit)/i,
          /не\s*подлеж\w+\s*удален/i,
          /хран\w+\s*(бессрочно|неограничен)/i,
          /невозможн\w+\s*удал/i,
        ],
      },
      {
        id: 'liability',
        label: 'Ограничение ответственности',
        icon: '⚖️',
        severity: 'high',
        patterns: [
          /no\s*liability/i,
          /without\s*warranty/i,
          /as\s*is/i,
          /не\s*нес[её]\w*\s*ответственност/i,
          /без\s*гарантий/i,
          /как\s*есть/i,
        ],
      },
      {
        id: 'arbitration',
        label: 'Обязательный арбитраж',
        icon: '🏛️',
        severity: 'high',
        patterns: [
          /binding\s*arbitration/i,
          /waive.*right.*court/i,
          /class\s*action\s*waiver/i,
          /обязательн\w+\s*арбитраж/i,
          /отказ\w*\s*от\s*суд/i,
        ],
      },
      {
        id: 'content_rights',
        label: 'Права на контент',
        icon: '📝',
        severity: 'medium',
        patterns: [
          /grant\s*(us)?\s*(a\s*)?(worldwide|perpetual|irrevocable|non.?exclusive)\s*license/i,
          /we\s*(may|can)\s*use\s*your\s*content/i,
          /предоставля\w+\s*нам\s*прав/i,
          /неисключительн\w+\s*(безвозмездн\w+\s*)?лицензи/i,
        ],
      },
      {
        id: 'tracking',
        label: 'Отслеживание',
        icon: '👁️',
        severity: 'medium',
        patterns: [
          /track(ing)?\s*(your)?\s*(activity|behavior|usage|location)/i,
          /collect.*(location|biometric|device|fingerprint)/i,
          /отслежива\w+\s*(активност|поведен|местоположен)/i,
          /сбор\w*\s*(геолокац|биометр)/i,
        ],
      },
      {
        id: 'changes',
        label: 'Изменения без уведомления',
        icon: '📢',
        severity: 'medium',
        patterns: [
          /change.*(terms|policy)\s*(at\s*any\s*time|without\s*notice)/i,
          /right\s*to\s*modify/i,
          /измен\w+\s*(условия|полити)\w+\s*без\s*уведомлен/i,
          /право\s*изменять/i,
        ],
      },
    ];

    function findTosLinks() {
      const links = [];
      const seen = new Set();
      document.querySelectorAll('a[href]').forEach((a) => {
        const text = (a.textContent || '').trim();
        const href = a.href;
        if (!href || href === '#' || seen.has(href)) return;
        const hrefLower = href.toLowerCase();
        const combined = text + ' ' + hrefLower;
        for (const p of TOS_LINK_PATTERNS) {
          if (p.test(combined)) {
            seen.add(href);
            const type = /privacy|конфиденциальност|cookie/i.test(combined) ? 'privacy' : 'tos';
            links.push({ url: href, text: text.slice(0, 100), type });
            break;
          }
        }
      });
      return links;
    }

    function fetchViaBackground(url) {
      return new Promise((resolve) => {
        api.runtime.sendMessage({ type: 'fetch_document', url }, (response) => {
          if (api.runtime.lastError) {
            resolve({ error: api.runtime.lastError.message });
            return;
          }
          resolve(response || { error: 'no response' });
        });
      });
    }

    function analyzeTextAI(text, docType) {
      return new Promise((resolve) => {
        api.runtime.sendMessage(
          { type: 'gemini_analyze', text: text.slice(0, 30000), docType },
          (response) => {
            if (api.runtime.lastError || !response) {
              resolve(null);
              return;
            }
            if (response.error === 'no_api_key') {
              console.info('EulaAlert: API-ключ не задан');
              resolve(null);
              return;
            }
            if (response.error === 'invalid_api_key') {
              console.warn('EulaAlert: неверный API-ключ');
              resolve(null);
              return;
            }
            if (response.error === 'rate_limit') {
              console.warn('EulaAlert: лимит запросов API');
              resolve({ __rateLimited: true });
              return;
            }
            if (response.error) {
              console.warn('EulaAlert: AI -', response.error);
              resolve(null);
              return;
            }
            resolve(response.result || null);
          }
        );
      });
    }

    function analyzeTextLocal(text) {
      const findings = [];
      for (const rule of RISK_PATTERNS) {
        const excerpts = [];
        for (const p of rule.patterns) {
          const m = text.match(p);
          if (m) {
            const idx = m.index;
            const start = Math.max(0, idx - 60);
            const end = Math.min(text.length, idx + m[0].length + 60);
            excerpts.push(text.slice(start, end).trim());
          }
        }
        if (excerpts.length > 0) {
          findings.push({
            id: rule.id,
            label: rule.label,
            icon: rule.icon,
            severity: rule.severity,
            excerpts: excerpts.slice(0, 3),
          });
        }
      }
      return findings;
    }

    async function analyzeAll() {
      const links = findTosLinks();
      const results = [];
      let totalScore = 0;
      let rateLimited = false;
      const settings = await EulaAlertStorage.getSettings();
      for (const link of links.slice(0, 5)) {
        const doc = { url: link.url, text: link.text, type: link.type, findings: [], docLength: 0 };
        const resp = await fetchViaBackground(link.url);
        if (resp.error) {
          doc.findings.push({
            id: 'fetch_error',
            label: 'Не удалось загрузить',
            icon: '⚠️',
            severity: 'low',
            excerpts: [resp.error],
          });
          results.push(doc);
          continue;
        }
        const text = resp.text || '';
        doc.docLength = text.length;
        doc.findings = analyzeTextLocal(text);
        if (settings.useAI && text.length > 100 && !rateLimited) {
          const ai = await analyzeTextAI(text, link.type);
          if (ai && ai.__rateLimited) {
            rateLimited = true;
          } else if (ai) {
            doc.aiSummary = ai.summary;
            doc.aiRecommendation = ai.recommendation;
            doc.aiRisks = (ai.risks || []).map((r) => ({
              category: r.category,
              severity: r.severity,
              description: r.description,
              excerpt: r.excerpt,
            }));
          }
        }
        const sevScore = { critical: 25, high: 15, medium: 8, low: 3 };
        for (const f of doc.findings) totalScore += sevScore[f.severity] || 5;
        for (const r of doc.aiRisks || []) totalScore += sevScore[r.severity] || 5;
        results.push(doc);
      }
      return { score: Math.min(100, totalScore), results, rateLimited };
    }

    return { findTosLinks, analyzeAll };
  })();
}
