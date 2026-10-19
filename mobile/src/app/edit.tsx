import React, { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Field, Header, Notice } from '../components/UI';
import { editTag, getTag } from '../services/repository';
import { useArchive } from '../state/Archive';
import { ui } from '../theme';
import type { Tag } from '../types';
export default function Edit() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    { alias, refresh, session, isDemo } = useArchive();
  const [tag, setTag] = useState<Tag | null>(null),
    [title, setTitle] = useState(''),
    [description, setDescription] = useState(''),
    [lat, setLat] = useState(''),
    [lng, setLng] = useState(''),
    [reason, setReason] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    getTag(id)
      .then((t) => {
        if (t) {
          setTag(t);
          setTitle(t.title);
          setDescription(t.description);
          setLat(String(t.latitude));
          setLng(String(t.longitude));
        } else setError('This tag was not found.');
      })
      .catch((e) => setError(e.message));
  }, [id]);
  const submit = async () => {
    if (!tag) return;
    setBusy(true);
    setError('');
    try {
      if (!lat.trim() || !lng.trim()) throw new Error('Both coordinates are required.');
      await editTag(
        tag,
        { title: title.trim(), description: description.trim(), latitude: +lat, longitude: +lng },
        reason,
        alias,
      );
      refresh();
      router.back();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <SafeAreaView style={ui.screen}>
      <Header title="Improve this record" subtitle="Changes stay in the edit history" />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: 22,
          gap: 18,
          maxWidth: 650,
          width: '100%',
          alignSelf: 'center',
        }}
      >
        {!isDemo && !session ? (
          <Button title="Sign in to edit" onPress={() => router.push('/account')} />
        ) : (
          <>
            <Text style={ui.title}>A better record,{'\n'}one edit at a time.</Text>
            <Notice text="Edit the wall’s details here. Previous versions are kept and can be restored. Photographs are preserved." />
            {!!error && <Notice text={error} error />}
            <Field label="Wall name" value={title} onChangeText={setTitle} maxLength={100} />
            <Field
              label="Description"
              value={description}
              onChangeText={setDescription}
              multiline
              maxLength={2000}
            />
            <View style={ui.row}>
              <View style={{ flex: 1 }}>
                <Field
                  label="Latitude"
                  value={lat}
                  onChangeText={setLat}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Field
                  label="Longitude"
                  value={lng}
                  onChangeText={setLng}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            </View>
            <Field
              label="What changed, and why?"
              value={reason}
              onChangeText={setReason}
              multiline
              placeholder="e.g. Moved the pin to the east-facing wall."
              maxLength={500}
            />
            <Button
              title={isDemo ? 'Save local edit' : 'Save edit'}
              icon="checkmark"
              busy={busy}
              disabled={!tag}
              onPress={submit}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
