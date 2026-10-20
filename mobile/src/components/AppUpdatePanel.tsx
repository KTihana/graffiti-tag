import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { Button, Notice } from './UI';
import { useAppUpdates } from '../state/AppUpdates';
import { ui } from '../theme';
import { getNativeBridge } from '../services/nativeBridge';
import { PERSONAL_APP_VERSION } from '../services/appUpdates';
export function AppUpdateBanner() {
  const { release, downloading, downloaded } = useAppUpdates();
  if (!release) return null;
  return <Button title={downloading ? 'Downloading update…' : downloaded ? 'Update ready to install' : `Update ${release.version} available`} icon="download-outline" onPress={() => router.push('/account')} />;
}
export default function AppUpdatePanel() {
  const { version, release, checked, busy, error, check, progress, downloading, downloaded, installing, installError, download, install } = useAppUpdates();
  const [reloadError, setReloadError] = useState('');
  const reloadFiles = async () => {
    setReloadError('');
    try { await getNativeBridge()?.reloadAppFiles?.(); }
    catch { setReloadError('Could not reload app files. Please close and reopen the app.'); }
  };
  return (
    <View style={{ gap: 12 }}>
      <Text style={ui.subtitle}>App updates</Text>
      <Text style={ui.muted}>Version {version} · Personal Android</Text>
      <Text style={ui.muted}>App files {PERSONAL_APP_VERSION}</Text>
      <Text style={ui.body}>Check, download, and install updates here. Your photos and archive stay on this device.</Text>
      {version !== PERSONAL_APP_VERSION && <Notice text="The app screens do not match the installed version. Reload app files below." error />}
      {!!reloadError && <Notice text={reloadError} error />}
      {!!error && <Notice text={error} error />}
      {!!installError && <Notice text={installError} error />}
      {!error && checked && !release && <Notice text="You have the latest version." />}
      {release && <>
        <Notice text={`Version ${release.version} is available.`} />
        {!!release.notes && <Text style={ui.muted}>{release.notes}</Text>}
        {downloading && <View accessibilityRole="progressbar" accessibilityLabel="Update download" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress ?? undefined} aria-valuetext={progress === null ? 'Downloading' : `${progress}%`}>
          <Text style={ui.body}>{progress === null ? 'Downloading update…' : `Downloading update… ${progress}%`}</Text>
        </View>}
        {downloaded ? <>
          <Notice text="Update downloaded. Ready to install." />
          <Button title="Install update" icon="download-outline" disabled={installing} busy={installing} onPress={() => void install()} />
        </> : <Button title={`Download update ${release.version}`} icon="download-outline" disabled={downloading || busy} busy={downloading} onPress={() => void download()} />}
      </>}
      <Button title="Check for updates" secondary disabled={downloading || installing} busy={busy} onPress={() => void check()} />
      {!!getNativeBridge()?.reloadAppFiles && <>
        <Button title="Reload app files" secondary disabled={downloading || installing} onPress={() => void reloadFiles()} />
        <Text style={ui.muted}>Refresh the app screens while keeping your photos, saved graffiti, and collections.</Text>
      </>}
      <Text style={ui.muted}>Android will ask you to confirm installation. If asked, allow updates from Graffiti Tag and return here. If you cancel, tap Install update to try again.</Text>
    </View>
  );
}
