import React, { useState } from 'react';
import { Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { Button, Notice } from './UI';
import { useAppUpdates } from '../state/AppUpdates';
import { RELEASES_URL } from '../services/appUpdates';
import { ui } from '../theme';
export function AppUpdateBanner() {
  const { release } = useAppUpdates();
  if (!release) return null;
  return <Button title={`Update ${release.version} available`} icon="download-outline" onPress={() => router.push('/account')} />;
}
export default function AppUpdatePanel() {
  const { version, release, checked, busy, error, check } = useAppUpdates();
  const [openError, setOpenError] = useState('');
  const open = async (url: string) => {
    setOpenError('');
    try { await Linking.openURL(url); }
    catch { setOpenError('Could not open the download. Try again or open the GitHub releases page in your browser.'); }
  };
  return (
    <View style={{ gap: 12 }}>
      <Text style={ui.subtitle}>App updates</Text>
      <Text style={ui.muted}>Version {version} · Personal Android</Text>
      <Text style={ui.body}>The Android app checks GitHub for updates when it starts. You can also check here anytime.</Text>
      {!!error && <Notice text={error} error />}
      {!!openError && <Notice text={openError} error />}
      {!error && checked && !release && <Notice text="You have the latest version." />}
      {release && <>
        <Notice text={`Version ${release.version} is available.`} />
        {!!release.notes && <Text style={ui.muted}>{release.notes}</Text>}
        <Button title={`Download update ${release.version}`} icon="download-outline" onPress={() => void open(release.downloadUrl)} />
      </>}
      <Button title="Check for updates" secondary busy={busy} onPress={() => void check()} />
      <Button title="View GitHub releases" secondary onPress={() => void open(RELEASES_URL)} />
      <Text style={ui.muted}>Download the APK in your browser, then open it to install the update. Android may ask you to allow installs from your browser. Install over this app to keep your photos and records; do not uninstall first. Export a backup before updating.</Text>
    </View>
  );
}
