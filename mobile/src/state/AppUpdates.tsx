import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { fetchLatestRelease, isNewerVersion, PERSONAL_APP_VERSION, type AppRelease } from '../services/appUpdates';
import { getNativeBridge } from '../services/nativeBridge';
import { useArchive } from './Archive';

type UpdateState = { version: string; release: AppRelease | null; busy: boolean; checked: boolean; error: string; progress: number | null; downloading: boolean; downloaded: boolean; installing: boolean; installError: string; download: () => Promise<void>; install: () => Promise<void>; check: () => Promise<void> };
const Context = createContext<UpdateState | null>(null);
export function AppUpdatesProvider({ children }: { children: React.ReactNode }) {
  const { isPersonal } = useArchive();
  const [version, setVersion] = useState(PERSONAL_APP_VERSION);
  const [release, setRelease] = useState<AppRelease | null>(null);
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState<number | null>(null);
  const [downloading, setDownloading] = useState(false), [downloadedUrl, setDownloadedUrl] = useState('');
  const [installing, setInstalling] = useState(false), [installError, setInstallError] = useState('');
  const updating = useRef(false);
  const pending = useRef(false);
  const check = useCallback(async () => {
    if (!isPersonal || pending.current || updating.current) return;
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
  const download = async () => {
    if (!release || updating.current) return;
    const native = getNativeBridge();
    if (!native?.downloadUpdate) { setInstallError('In-app updates are available in the Android app.'); return; }
    updating.current = true; setDownloading(true); setProgress(null); setInstallError('');
    try {
      await native.downloadUpdate(release.downloadUrl, setProgress);
      setDownloadedUrl(release.downloadUrl);
    } catch (e) { setInstallError((e as Error).message || 'Download failed. Please try again.'); }
    finally { updating.current = false; setDownloading(false); }
  };
  const install = async () => {
    if (!release || downloadedUrl !== release.downloadUrl || updating.current) return;
    updating.current = true; setInstalling(true); setInstallError('');
    try { await getNativeBridge()?.installUpdate?.(); }
    catch (e) { setInstallError((e as Error).message || 'Could not start installation. Please retry.'); }
    finally { updating.current = false; setInstalling(false); }
  };
  useEffect(() => {
    if (!getNativeBridge()) return;
    const timer = setTimeout(() => { void check(); }, 0);
    return () => clearTimeout(timer);
  }, [check]);
  return <Context.Provider value={{ version, release, busy, checked, error, check, progress, downloading, downloaded: !!release && downloadedUrl === release.downloadUrl, installing, installError, download, install }}>{children}</Context.Provider>;
}
export function useAppUpdates() {
  const value = useContext(Context);
  if (!value) throw new Error('AppUpdatesProvider is missing');
  return value;
}
