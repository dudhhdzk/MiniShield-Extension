
if (!window.FormHelper) {
  window.FormHelper = (() => {
    const TYPE_MAP = {
      first: 'firstName', given: 'firstName', fname: 'firstName',
      last: 'lastName', family: 'lastName', lname: 'lastName', surname: 'lastName',
      email: 'email', mail: 'email',
      phone: 'phone', tel: 'phone', mobile: 'phone', telephone: 'phone',
      user: 'username', login: 'username', nick: 'username', username: 'username',
      birth: 'birthDate', dob: 'birthDate', birthday: 'birthDate',
      country: 'country', nation: 'country',
      city: 'city', town: 'city',
      org: 'organization', company: 'organization', organization: 'organization',
      address: 'address', addr: 'address', street: 'address'
    };

    function getFieldSignature(el) {
      const raw = [el.name, el.id, el.placeholder, el.getAttribute('aria-label'),
        el.getAttribute('autocomplete'), el.getAttribute('data-field'),
        el.className, el.closest('label')?.textContent].filter(Boolean).join(' ').toLowerCase();
      return raw;
    }

    function mapFieldToProfile(el) {
      const sig = getFieldSignature(el);
      const type = el.type?.toLowerCase() || 'text';
      if (type === 'tel' || type === 'phone') return 'phone';
      if (el.hasAttribute('data-intl-tel-input-id')) return 'phone';
      if (type === 'email') return 'email';
      if (type === 'date') return 'birthDate';
      for (const [key, val] of Object.entries(TYPE_MAP)) {
        if (sig.includes(key)) return val;
      }
      return null;
    }

    async function autoFill() {
      const profile = await EulaAlertStorage.getProfile();
      const inputs = document.querySelectorAll('input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=checkbox]):not([type=radio]), textarea, select');
      let filled = 0, total = 0;
      inputs.forEach(el => {
        if (el.offsetParent === null) return;
        const key = mapFieldToProfile(el);
        if (!key) return;
        total++;
        const val = profile[key];
        if (!val) return;
        if (el.value && el.value.trim()) return;
        const nativeSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
          || Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
        if (nativeSet) nativeSet.call(el, val); else el.value = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('keyup', { bubbles: true }));
        el.dispatchEvent(new Event('blur', { bubbles: true }));
        el.style.boxShadow = '0 0 0 2px #66bb6a';
        setTimeout(() => el.style.boxShadow = '', 3000);
        filled++;
      });
      return { filled, total };
    }

    function isRegistrationPage() {
      const forms = document.querySelectorAll('form');
      const keywords = /sign.?up|regist|create.?account|join|enroll|подпис|регистр|создать.?акк/i;
      for (const f of forms) {
        if (keywords.test(f.action || '') || keywords.test(f.id || '') || keywords.test(f.className || '')) return true;
        const inputs = f.querySelectorAll('input[type=password], input[type=email]');
        if (inputs.length >= 2) return true;
      }
      const h = document.title + ' ' + (document.querySelector('h1')?.textContent || '');
      return keywords.test(h);
    }

    function detectCheckboxes() {
      const result = [];
      const suspicious = /newsletter|marketing|agree|terms|условия|согласие|рассылк|подписк|third.party|третьи|персонал|данн/i;
      document.querySelectorAll('input[type=checkbox]').forEach(cb => {
        const label = (cb.labels?.[0]?.textContent || cb.closest('label')?.textContent || cb.parentElement?.textContent || '').trim().slice(0, 200);
        if (!label || !suspicious.test(label)) return;
        const icon = /marketing|рассылк|newsletter/i.test(label) ? '📧' : /agree|terms|условия|согласие/i.test(label) ? '📋' : '⚠️';
        result.push({ label, checked: cb.checked, icon });
      });
      return result;
    }

    function fillTempEmail(email) {
      const emailInputs = document.querySelectorAll(
        'input[type=email], input[autocomplete=email], input[name*=email i], ' +
        'input[id*=email i], input[placeholder*=email i], input[placeholder*=mail i]'
      );
      let filled = 0;
      emailInputs.forEach(el => {
        if (el.offsetParent === null) return;
        const nativeSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        if (nativeSet) nativeSet.call(el, email); else el.value = email;
        el.dispatchEvent(new Event('input',  { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('keyup',  { bubbles: true }));
        el.dispatchEvent(new Event('blur',   { bubbles: true }));
        el.style.boxShadow = '0 0 0 2px #42a5f5';
        setTimeout(() => el.style.boxShadow = '', 3000);
        filled++;
      });
      
      if (!filled) {
        document.querySelectorAll('input:not([type=hidden]):not([type=submit]):not([type=button])').forEach(el => {
          if (el.offsetParent === null) return;
          if (mapFieldToProfile(el) === 'email' && !el.value.trim()) {
            const nativeSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
            if (nativeSet) nativeSet.call(el, email); else el.value = email;
            el.dispatchEvent(new Event('input',  { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.dispatchEvent(new Event('keyup',  { bubbles: true }));
            el.dispatchEvent(new Event('blur',   { bubbles: true }));
            el.style.boxShadow = '0 0 0 2px #42a5f5';
            setTimeout(() => el.style.boxShadow = '', 3000);
            filled++;
          }
        });
      }
      return filled;
    }

    const CODE_FIELD_RE = /\b(code|otp|pin|token|confirm|verif|sms|одноразов|код|пін|пин|подтвержд|captcha|2fa|mfa|totp|auth.?code|security.?code|access.?code)/i;

    function detectCodeField() {
      const candidates = document.querySelectorAll(
        'input[type=text], input[type=number], input[type=tel], input:not([type]), ' +
        'input[inputmode=numeric], input[inputmode=decimal], input[autocomplete=one-time-code], ' +
        'input[pattern*="[0-9]"], input[data-otp], input[data-code]'
      );
      
      for (const el of candidates) {
        if (el.offsetParent === null) continue;
        if (CODE_FIELD_RE.test(getFieldSignature(el))) return el;
      }
      
      for (const el of candidates) {
        if (el.offsetParent === null) continue;
        if (el.getAttribute('autocomplete') === 'one-time-code') return el;
      }
      
      for (const el of candidates) {
        if (el.offsetParent === null) continue;
        const parent = el.closest('div, fieldset, section, form');
        if (!parent) continue;
        const nearbyText = (parent.querySelector('label, .label, h1, h2, h3, h4, p')?.textContent || '').trim();
        if (CODE_FIELD_RE.test(nearbyText)) return el;
      }
      
      const shorts = [...candidates].filter(el => {
        if (el.offsetParent === null || el.value.trim()) return false;
        const ml = parseInt(el.maxLength) || 0;
        return ml >= 4 && ml <= 10;
      });
      if (shorts.length === 1) return shorts[0];
      
      const numericInputs = [...candidates].filter(el => {
        if (el.offsetParent === null || el.value.trim()) return false;
        return el.getAttribute('inputmode') === 'numeric';
      });
      if (numericInputs.length === 1) return numericInputs[0];
      
      const singles = [...candidates].filter(el => {
        if (el.offsetParent === null) return false;
        const ml = parseInt(el.maxLength) || 0;
        return ml === 1 && !el.value.trim();
      });
      if (singles.length >= 4) return singles[0];
      
      const allVisible = [...candidates].filter(el => el.offsetParent !== null && !el.value.trim());
      if (allVisible.length === 1) return allVisible[0];
      return null;
    }

    function fillCode(code) {
      if (!code) return false;
      
      const cleanCode = String(code).replace(/[\s\-]/g, '');
      const first = detectCodeField();
      if (!first) return false;
      const ml = parseInt(first.maxLength) || 0;

      if (ml === 1) {
        const allSingles = [...document.querySelectorAll('input')].filter(el => {
          if (el.offsetParent === null) return false;
          return (parseInt(el.maxLength) || 0) === 1 && !el.value.trim();
        });
        const digits = cleanCode.split('');
        digits.forEach((digit, i) => {
          const el = allSingles[i];
          if (!el) return;
          const nativeSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
          if (nativeSet) nativeSet.call(el, digit); else el.value = digit;
          el.dispatchEvent(new Event('input',  { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          el.dispatchEvent(new Event('keyup',  { bubbles: true }));
          el.style.boxShadow = '0 0 0 2px #66bb6a';
          setTimeout(() => el.style.boxShadow = '', 3000);
        });
        return true;
      }

      const nativeSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      if (nativeSet) nativeSet.call(first, cleanCode); else first.value = cleanCode;
      first.dispatchEvent(new Event('input',  { bubbles: true }));
      first.dispatchEvent(new Event('change', { bubbles: true }));
      first.dispatchEvent(new Event('keyup',  { bubbles: true }));
      first.dispatchEvent(new Event('blur',   { bubbles: true }));
      first.style.boxShadow = '0 0 0 2px #66bb6a';
      setTimeout(() => first.style.boxShadow = '', 3000);
      return true;
    }

    return { autoFill, isRegistrationPage, detectCheckboxes, fillTempEmail, fillCode, detectCodeField };
  })();
}
