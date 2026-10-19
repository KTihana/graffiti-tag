import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Field, Header, Icon, Notice } from '../components/UI';
import { supabase } from '../services/supabase';
import { useArchive } from '../state/Archive';
import PersonalArchivePanel from '../components/PersonalArchivePanel';
import { colors, ui } from '../theme';
export default function Account() {
  const { isDemo, isPersonal, session, alias, moderator } = useArchive();
  const [email, setEmail] = useState(''),
    [name, setName] = useState(''),
    [code, setCode] = useState(''),
    [sent, setSent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const submit = async () => {
    setError('');
    setBusy(true);
    try {
      if (!sent) {
        if (name.trim().length < 2 || name.length > 40)
          throw new Error('Choose a public alias between 2 and 40 characters.');
        const { error: e } = await supabase!.auth.signInWithOtp({
          email: email.trim(),
          options: { data: { alias: name.trim() } },
        });
        if (e) throw e;
        setSent(true);
      } else {
        const { error: e } = await supabase!.auth.verifyOtp({
          email: email.trim(),
          token: code.trim(),
          type: 'email',
        });
        if (e) throw e;
        router.back();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <SafeAreaView style={ui.screen}>
      <Header title={isPersonal ? 'My archive' : 'Your little part of the archive'} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: 24,
          gap: 21,
          width: '100%',
          maxWidth: 560,
          alignSelf: 'center',
        }}
      >
        <View
          style={{
            width: 70,
            height: 70,
            backgroundColor: colors.lime,
            borderRadius: 24,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Icon name="finger-print-outline" size={38} />
        </View>
        <Text style={ui.title}>
          {isPersonal
            ? 'Your personal archive'
            : session
              ? `Hello, ${alias}.`
              : 'Leave a record.\nKeep a story alive.'}
        </Text>
        {!!error && <Notice text={error} error />}
        {isPersonal ? (
          <PersonalArchivePanel />
        ) : isDemo ? (
          <>
            <Notice text="You’re exploring the local demo. Photos, edits, saved tags, and reports stay on this device. There is no shared account or public publishing yet." />
            <Text style={ui.body}>
              Your demo contributions appear as “Local contributor”. The shared archive activates
              when the app is connected to its backend.
            </Text>
            <Button title="Explore the demo" onPress={() => router.replace('/')} />
            <Button
              title="Demo moderation queue"
              secondary
              onPress={() => router.push('/moderate')}
            />
          </>
        ) : session ? (
          <>
            <Text style={ui.body}>
              Your contributions are credited to your public alias. Your email is never included in
              the public archive.
            </Text>
            {moderator && (
              <Button title="Moderation queue" secondary onPress={() => router.push('/moderate')} />
            )}
            <Button
              title="Sign out"
              secondary
              onPress={async () => {
                const { error: e } = await supabase!.auth.signOut();
                if (e) setError(e.message);
              }}
            />
          </>
        ) : (
          <>
            <Text style={ui.body}>
              Everyone can explore. Sign in with an email code to add photos and help improve the
              records.
            </Text>
            {!sent ? (
              <>
                <Field
                  label="Public alias"
                  value={name}
                  onChangeText={setName}
                  placeholder="How should we credit you?"
                  maxLength={40}
                />
                <Field
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="you@example.com"
                />
              </>
            ) : (
              <>
                <Notice text={`Enter the sign-in code sent to ${email}.`} />
                <Field
                  label="Email code"
                  value={code}
                  onChangeText={setCode}
                  keyboardType="number-pad"
                  autoComplete="one-time-code"
                />
              </>
            )}
            <Button
              title={sent ? 'Verify and sign in' : 'Send sign-in code'}
              busy={busy}
              onPress={submit}
            />
            {sent && <Button title="Use another email" secondary onPress={() => setSent(false)} />}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
