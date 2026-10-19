import React, { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Header, Notice } from '../components/UI';
import { listReports, resolveReport } from '../services/repository';
import { useArchive } from '../state/Archive';
import { ui } from '../theme';
import type { Report } from '../types';
export default function Moderate() {
  const { isDemo, moderator } = useArchive();
  const [reports, setReports] = useState<Report[]>([]),
    [error, setError] = useState(''),
    [version, setVersion] = useState(0),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (isDemo || moderator)
      listReports()
        .then(setReports)
        .catch((e) => setError(e.message));
  }, [isDemo, moderator, version]);
  const resolve = async (id: string) => {
    setBusy(true);
    try {
      await resolveReport(id);
      setVersion((v) => v + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <SafeAreaView style={ui.screen}>
      <Header title="Care for the archive" subtitle="Moderation queue" />
      <ScrollView
        contentContainerStyle={{
          padding: 22,
          gap: 18,
          maxWidth: 650,
          width: '100%',
          alignSelf: 'center',
        }}
      >
        {!isDemo && !moderator ? (
          <Notice text="This page is available to archive moderators." />
        ) : (
          <>
            {isDemo && (
              <Notice text="Local demo queue. These reports have not been sent to anyone." />
            )}
            {!!error && <Notice text={error} error />}
            {!reports.length && <Text style={ui.body}>No open reports.</Text>}
            {reports.map((r) => (
              <View key={r.id} style={[ui.card, { gap: 14 }]}>
                <Text style={ui.label}>{new Date(r.createdAt).toLocaleDateString('en-GB')}</Text>
                <Text style={ui.body}>{r.reason}</Text>
                <Button
                  title="Review wall"
                  secondary
                  onPress={() => router.push(`/tag/${r.tagId}`)}
                />
                <Button title="Mark resolved" busy={busy} onPress={() => resolve(r.id)} />
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
