/* Only the browser preference is stored; this module does not enable trackers. */
(() => {
  'use strict';
  const KEY = 'vse-expertizy.cookie-preference';
  const VERSION = '2026-09-23';
  const TTL = 180 * 24 * 60 * 60 * 1000;
  const banner = document.getElementById('cookieNotice');
  const settings = document.getElementById('cookieSettings');
  const status = document.getElementById('cookieStatus');
  if (!banner || !settings) return;

  function removePreference() {
    try { localStorage.removeItem(KEY); return true; } catch (_) { return false; }
  }
  function hasPreference() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return false;
      const value = JSON.parse(raw);
      const now = Date.now();
      if (value && value.version === VERSION && value.accepted === true &&
          Number.isFinite(value.savedAt) && Number.isFinite(value.expiresAt) &&
          value.savedAt <= now && value.expiresAt > now && value.expiresAt - value.savedAt === TTL) return true;
    } catch (_) { /* Blocked or malformed storage must not break the page. */ }
    removePreference();
    return false;
  }
  function show(focus = false) {
    banner.hidden = false;
    settings.hidden = true;
    settings.setAttribute('aria-expanded', 'true');
    if (focus) banner.querySelector('[data-cookie-accept]').focus();
  }
  function hide(focus = false) {
    banner.hidden = true;
    settings.hidden = false;
    settings.setAttribute('aria-expanded', 'false');
    if (focus) settings.focus();
  }
  function announce(message) { status.textContent = message; }

  banner.querySelector('[data-cookie-accept]').addEventListener('click', () => {
    const savedAt = Date.now();
    let saved = false;
    try {
      localStorage.setItem(KEY, JSON.stringify({ version: VERSION, accepted: true, savedAt, expiresAt: savedAt + TTL }));
      saved = true;
    } catch (_) { /* Continue without persistence when storage is unavailable. */ }
    hide(true);
    announce(saved ? 'Настройка сохранена на 180 дней. Изменить её можно кнопкой Cookie.' : 'Браузер не разрешил сохранить настройку. При следующем посещении плашка появится снова.');
  });
  banner.querySelector('[data-cookie-decline]').addEventListener('click', () => {
    const removed = removePreference();
    hide(true);
    announce(removed ? 'Настройка не сохраняется. При следующем открытии страницы плашка появится снова.' : 'Хранилище браузера недоступно. Если настройка была сохранена ранее, удалите данные сайта в настройках браузера.');
  });
  settings.addEventListener('click', () => show(true));
  document.querySelectorAll('[data-cookie-settings]').forEach(button => button.addEventListener('click', () => show(true)));
  banner.querySelector('[data-cookie-policy]').addEventListener('click', () => {
    // Opening the policy neither grants consent nor persists a preference.
    hide();
    requestAnimationFrame(() => {
      const target = document.getElementById('privacyCookies');
      target?.scrollIntoView({ block: 'start', behavior: 'instant' });
      target?.setAttribute('tabindex', '-1');
      target?.focus({ preventScroll: true });
    });
  });
  window.addEventListener('storage', event => {
    if (event.key === KEY || event.key === null) hasPreference() ? hide() : show();
  });
  hasPreference() ? hide() : show();
})();
