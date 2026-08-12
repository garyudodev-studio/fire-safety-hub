'use client';

import React, { useCallback, useState, useSyncExternalStore } from 'react';
import Sidebar from '../Sidebar';

type Theme = 'dark' | 'light';

const THEME_KEY = 'system-hub-theme';

const themeSubscribers = new Set<() => void>();

function getSnapshot(): Theme {
  const saved = localStorage.getItem(THEME_KEY);
  return saved === 'light' ? 'light' : 'dark';
}

function getServerSnapshot(): Theme {
  return 'dark';
}

function subscribe(callback: () => void): () => void {
  themeSubscribers.add(callback);
  return () => themeSubscribers.delete(callback);
}

function persist(theme: Theme) {
  localStorage.setItem(THEME_KEY, theme);
  themeSubscribers.forEach((cb) => cb());
}

export default function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleTheme = useCallback(() => {
    persist(theme === 'dark' ? 'light' : 'dark');
  }, [theme]);

  return (
    <div
      className={`flex min-h-screen bg-ink-950 text-ink-200 ${
        theme === 'light' ? 'theme-light' : ''
      }`}
    >
      <Sidebar theme={theme} onToggleTheme={toggleTheme} onMobileMenuChange={setMobileMenuOpen} />
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto pt-14 md:pt-0">
        {children}
      </main>

      {/* ── Floating theme toggle (bottom-left, hidden while mobile drawer is open) ── */}
      {!mobileMenuOpen && (
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          aria-label="Toggle theme"
          className="fixed bottom-5 left-4 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-ember-600 text-white shadow-lg shadow-ember-950/40 hover:bg-ember-500 active:scale-95 transition-all"
        >
          {theme === 'dark' ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>
      )}
    </div>
  );
}