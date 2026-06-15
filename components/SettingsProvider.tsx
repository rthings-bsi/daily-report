'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import type { GudangSettings } from '@/lib/settings';
import { DEFAULT_SETTINGS } from '@/lib/settings';

interface SettingsContextValue {
  settings: GudangSettings;
  isLoading: boolean;
  error: string | null;
  save: (partial: Partial<GudangSettings>) => Promise<void>;
  refresh: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { data: session, status } = useSession();
  const [settings, setSettings] = useState<GudangSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const gudangId = session?.user?.gudangId ?? null;

  const load = useCallback(async () => {
    if (status !== 'authenticated' || gudangId === null) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings({ ...DEFAULT_SETTINGS, ...data });
      } else {
        setError(`Gagal memuat settings (${res.status})`);
      }
    } catch (e: any) {
      setError(e?.message || 'Gagal memuat settings');
    } finally {
      setIsLoading(false);
    }
  }, [status, gudangId]);

  useEffect(() => {
    load();
  }, [load]);

  const save = useCallback(
    async (partial: Partial<GudangSettings>) => {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(partial),
      });
      if (!res.ok) {
        throw new Error(`Gagal menyimpan settings (${res.status})`);
      }
      setSettings((prev) => ({ ...prev, ...partial }));
    },
    [],
  );

  return (
    <SettingsContext.Provider value={{ settings, isLoading, error, save, refresh: load }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = (): SettingsContextValue => {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error('useSettings must be used within <SettingsProvider>');
  }
  return ctx;
};
