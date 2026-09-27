(() => {
  const validPreferences = new Set(['system', 'light', 'dark']);
  const readPreference = (value) => validPreferences.has(value) ? value : null;
  const cookieValue = document.cookie
    .split(';')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith('igda_theme='))
    ?.slice('igda_theme='.length);

  let storedValue = null;
  try {
    storedValue = window.localStorage.getItem('igda-theme');
  } catch {
    // The system setting is the fallback when storage is unavailable.
  }

  const preference = readPreference(cookieValue) || readPreference(storedValue) || 'system';
  const systemIsDark = typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = preference === 'system' ? (systemIsDark ? 'dark' : 'light') : preference;

  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.themePreference = preference;

  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.content = theme === 'dark' ? '#101012' : '#fff4dc';
})();
