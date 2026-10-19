import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { fetchLatestRelease, isNewerVersion, PERSONAL_APP_VERSION, type AppRelease } from '../services/appUpdates';
import { getNativeBridge } from '../services/nativeBridge';
import { useArchive } from './Archive';

type UpdateState = { version: string; release: AppRelease | null; busy: boolean; checked: boolean; error: string; check: () => Promise<void> };
const Context = createContext<UpdateState | null>(null);
export function AppUpdatesProvider({ children }: { children: React.ReactNode }) {
  const { isPersonal } = useArchive();
  const [version, setVersion] = useState(PERSONAL_APP_VERSION);
  const [release, setRelease] = useState<AppRelease | null>(null);
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const check = useCallback(async () => {
    if (!isPersonal || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      const installed = await getNativeBridge()?.getAppVersion?.() || PERSONAL_APP_VERSION;
      setVersion(installed);
      const latest = await fetchLatestRelease();
      setRelease(isNewerVersion(latest.version, installed) ? latest : null);
      setChecked(true);
    } catch {
      setError('Could not check for updates. Check your internet connection and try again. Your archive is still available offline.');
    } finally { pending.current = false; setBusy(false); }
  }, [isPersonal]);
  useEffect(() => {
    if (!getNativeBridge()) return;
    const timer = setTimeout(() => { void check(); }, 0);
    return () => clearTimeout(timer);
  }, [check]);
  return <Context.Provider value={{ version, release, busy, checked, error, check }}>{children}</Context.Provider>;
}
export function useAppUpdates() {
  const value = useContext(Context);
  if (!value) throw new Error('AppUpdatesProvider is missing');
  return value;
}
