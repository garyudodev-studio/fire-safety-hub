'use client';

import React, { useCallback, useSyncExternalStore } from 'react';
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

  const toggleTheme = useCallback(() => {
    persist(theme === 'dark' ? 'light' : 'dark');
  }, [theme]);

  return (
    <div
      className={`flex min-h-screen bg-ink-950 text-ink-200 ${
        theme === 'light' ? 'theme-light' : ''
      }`}
    >
      <Sidebar theme={theme} onToggleTheme={toggleTheme} />
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto pb-20 md:pb-0">
        {children}
      </main>
    </div>
  );
}