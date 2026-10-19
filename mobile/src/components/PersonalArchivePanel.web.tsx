import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Button, Notice } from './UI';
import { BACKUP_TIME_KEY, exportPersonalBackup, importPersonalBackup } from '../services/backup';
import { loadLocalArchive } from '../services/localArchive';
import { useArchive } from '../state/Archive';
import { getNativeBridge } from '../services/nativeBridge';
import { ui } from '../theme';

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
export default function PersonalArchivePanel() {
  const { version, refresh } = useArchive();
  const native = getNativeBridge();
  const [counts, setCounts] = useState({ tags: 0, photos: 0 });
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [offlineReady, setOfflineReady] = useState(false);
  const [persistent, setPersistent] = useState(false);
  const [install, setInstall] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches,
  );
  useEffect(() => {
    loadLocalArchive()
      .then((data) =>
        setCounts({
          tags: data.tags.length,
          photos: data.tags.reduce((n, tag) => n + tag.photos.length, 0),
        }),
      )
      .catch((e) => setError(e.message));
    AsyncStorage.getItem(BACKUP_TIME_KEY)
      .then(setLastBackup)
      .catch(() => {});
  }, [version]);
  useEffect(() => {
    navigator.storage
      ?.persisted?.()
      .then(setPersistent)
      .catch(() => {});
    let active = true;
    navigator.serviceWorker?.ready.then(() => {
      if (active) setOfflineReady(true);
    });
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstall(event as InstallPrompt);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstall(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      active = false;
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ gap: 18 }}>
      <Text style={ui.body}>
        {counts.tags} tags · {counts.photos} photos
      </Text>
      <Notice text="Your photos and records stay on this device. They are not uploaded or shared." />
      {!!error && <Notice text={error} error />}
      {!!message && <Notice text={message} />}
      <Text style={ui.subtitle}>On your phone</Text>
      <Text style={ui.body}>
        {native
          ? 'Installed Android app. Your archive works without your computer.'
          : installed
            ? 'Installed on your home screen.'
            : 'In Android Chrome, open the menu and choose Add to Home screen, then Install.'}
      </Text>
      {!!install && !installed && !native && (
        <Button
          title="Install Graffiti Tag"
          icon="download-outline"
          onPress={() =>
            run(async () => {
              await install.prompt();
              await install.userChoice;
              setInstall(null);
            })
          }
        />
      )}
      <Text style={ui.muted}>
        {native || offlineReady
          ? 'Ready for offline use: saved photos, records, and editing. Maps and place search need internet.'
          : 'Open the app online once and wait for offline preparation to finish.'}
      </Text>
      <Text style={ui.subtitle}>Back up your archive</Text>
      <Text style={ui.body}>
        Export a backup after adding photos. It includes original images, dates, captions, edit
        history, and saved tags. Keep a copy outside the app. This first version supports backup files up to 50 MB.
      </Text>
      <Text style={ui.muted}>
        {lastBackup
          ? `Last backup export: ${new Date(lastBackup).toLocaleString()}`
          : 'No backup exported yet.'}
      </Text>
      <Button
        title={native ? 'Export backup' : 'Download backup'}
        icon="download-outline"
        disabled={busy}
        onPress={() =>
          run(async () => {
            const result = await exportPersonalBackup();
            refresh();
            setMessage(
              native
                ? `Backup saved: ${result.tags} tags and ${result.photos} photos.`
                : `Backup download started: ${result.tags} tags and ${result.photos} photos. Check your Downloads folder.`,
            );
          })
        }
      />
      <Button
        title="Import backup"
        icon="folder-open-outline"
        secondary
        disabled={busy}
        onPress={() =>
          run(async () => {
            const result = await importPersonalBackup();
            if (!result) return;
            refresh();
            setMessage(
              `Imported ${result.imported} tags. ${result.skipped} existing tags were kept as they are.`,
            );
          })
        }
      />
      <Text style={ui.muted}>
        Import adds missing tags. It does not replace tags already on this phone. Uninstalling the app, clearing its data, or losing your phone can remove your archive.
      </Text>
      {!persistent && !native && (
        <Button
          title="Protect local storage"
          secondary
          disabled={busy}
          onPress={() =>
            run(async () => {
              const granted = await navigator.storage?.persist?.();
              setPersistent(!!granted);
              setMessage(
                granted
                  ? 'Persistent storage is enabled. Keep exporting backups as well.'
                  : 'Your browser manages storage automatically. Backups are still the best way to keep a second copy.',
              );
            })
          }
        />
      )}
      {persistent && <Text style={ui.muted}>Persistent browser storage is enabled.</Text>}
    </View>
  );
}
