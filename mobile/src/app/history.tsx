import { artworkKinds } from '../categories';
import React, { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Header, Notice } from '../components/UI';
import { editRecord, editTag, getTag, history } from '../services/repository';
import { useArchive } from '../state/Archive';
import { ui } from '../theme';
import type { Revision, Snapshot } from '../types';
import { dateLabel } from '../domain';
function SnapshotText({ label, snapshot }: { label: string; snapshot: Snapshot }) {
  const r = snapshot.record;
  return (
    <View style={{ gap: 5 }}>
      <Text style={ui.label}>{label}</Text>
      {r ? (
        <Text style={ui.body}>
          {r.artworkTitle} · {r.artist}
          {'\n'}{artworkKinds(r).join(' · ')}
          {'\n'}
          {dateLabel(r)} · {r.condition}
          {'\n'}
          {r.caption}
          {'\n'}Photograph: {r.photographer}
        </Text>
      ) : (
        <Text style={ui.body}>
          {snapshot.title}
          {'\n'}
          {snapshot.description}
          {'\n'}
          {snapshot.latitude}, {snapshot.longitude}
        </Text>
      )}
    </View>
  );
}
export default function History() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    { version, refresh, alias, isDemo, session } = useArchive();
  const [items, setItems] = useState<Revision[]>([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  useEffect(() => {
    history(id)
      .then(setItems)
      .catch((e) => setError(e.message));
  }, [id, version]);
  const restore = async (r: Revision) => {
    if (!isDemo && !session) return router.push('/account');
    setBusy(true);
    setError('');
    try {
      const t = await getTag(id);
      if (!t || !r.before) throw new Error('The previous version could not be found.');
      if (r.before.record)
        await editRecord(
          t,
          r.before.record,
          `Restored photo details from before revision ${r.version}`,
          alias,
        );
      else
        await editTag(
          t,
          r.before,
          `Restored wall details from before revision ${r.version}`,
          alias,
        );
      refresh();
      setMessage(
        r.before.record
          ? 'Previous photo details restored. This restoration is recorded as a new edit.'
          : 'Previous wall details restored. This restoration is recorded as a new edit.',
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <SafeAreaView style={ui.screen}>
      <Header title="Edit history" subtitle="A transparent, recoverable record" />
      <ScrollView
        contentContainerStyle={{
          padding: 22,
          gap: 16,
          maxWidth: 650,
          width: '100%',
          alignSelf: 'center',
        }}
      >
        {!!error && <Notice text={error} error />}
        {!!message && <Notice text={message} />}
        {!items.length && (
          <Notice text="No community edits yet. Future edits and photo contributions will appear here." />
        )}
        {items.map((r) => (
          <View key={r.id} style={[ui.card, { gap: 12 }]}>
            <Text style={ui.label}>{new Date(r.createdAt).toLocaleString('en-GB')}</Text>
            <Text style={ui.subtitle}>{r.action}</Text>
            <Text style={ui.muted}>
              By {r.actor} · wall revision {r.version}
            </Text>
            {r.before && (
              <>
                <SnapshotText label="Before" snapshot={r.before} />
                <SnapshotText label="After" snapshot={r.after} />
                <Button
                  title={
                    r.before.record
                      ? 'Restore previous photo details'
                      : 'Restore previous wall details'
                  }
                  secondary
                  busy={busy}
                  onPress={() => restore(r)}
                />
              </>
            )}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
