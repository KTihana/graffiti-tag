import React, { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Field, Header, Notice } from '../components/UI';
import { reportTag } from '../services/repository';
import { useArchive } from '../state/Archive';
import { ui } from '../theme';
export default function Report() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    { alias, isDemo, session } = useArchive();
  const [reason, setReason] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await reportTag(id, reason, alias);
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <SafeAreaView style={ui.screen}>
      <Header title="Help care for the archive" />
      <ScrollView
        contentContainerStyle={{
          padding: 22,
          gap: 20,
          maxWidth: 650,
          width: '100%',
          alignSelf: 'center',
        }}
      >
        {done ? (
          <>
            <Notice
              text={
                isDemo
                  ? 'Report saved to the local demo moderation queue. It has not been sent to anyone.'
                  : 'Your report is in the moderation queue. Thank you for helping keep the archive accurate.'
              }
            />
            <Button title="Back to the wall" onPress={() => router.back()} />
          </>
        ) : !isDemo && !session ? (
          <Button title="Sign in to report" onPress={() => router.push('/account')} />
        ) : (
          <>
            <Text style={ui.title}>Something needs a second look?</Text>
            <Text style={ui.body}>
              Tell us about a duplicate tag, wrong attribution, incorrect location, or a photo that
              should be reviewed.
            </Text>
            {!!error && <Notice text={error} error />}
            <Field
              label="What should we review?"
              value={reason}
              onChangeText={setReason}
              multiline
              maxLength={2000}
              placeholder="Include enough detail for a moderator to understand the issue."
            />
            <Button
              title={isDemo ? 'Save demo report' : 'Send report'}
              busy={busy}
              onPress={submit}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
