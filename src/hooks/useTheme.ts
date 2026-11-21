import { useState, useEffect, useCallback } from 'react';

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'app-theme';

const THEME_META_COLORS: Record<Theme, string> = {
  dark: '#16151E',
  light: '#F3E9DC',
};

function getStoredTheme(): Theme | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {
    // ignore storage errors
  }
  return null;
}

/**
 * Sistem tercihini veya localStorage'daki manuel seçimi okur.
 */
function getInitialTheme(): Theme {
  const stored = getStoredTheme();
  if (stored) return stored;
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'dark';
}

function syncThemeColorMeta(theme: Theme) {
  const color = THEME_META_COLORS[theme];
  const dynamicMeta = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]#dynamic-theme-color'
  );
  if (dynamicMeta) {
    dynamicMeta.content = color;
  } else {
    const fallbackMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (fallbackMeta) fallbackMeta.content = color;
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  // <html> etiketine data-theme, colorScheme ve PWA theme-color senkronize et
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
    syncThemeColorMeta(theme);
  }, [theme]);

  // Kullanıcı manuel seçim yapmadıysa sistem teması değiştiğinde otomatik uyarla
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      if (!getStoredTheme()) {
        setThemeState(e.matches ? 'dark' : 'light');
      }
    };
    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore storage errors
    }
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }, []);

  return { theme, toggleTheme, setTheme };
}
