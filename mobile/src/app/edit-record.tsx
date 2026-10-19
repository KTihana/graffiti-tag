import React, { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Chip, Field, Header, Notice } from '../components/UI';
import { editRecord, getTag, recordDetails } from '../services/repository';
import { useArchive } from '../state/Archive';
import { ui } from '../theme';
import type { RecordDetails, Tag } from '../types';
export default function EditRecord() {
  const { id, photoId } = useLocalSearchParams<{ id: string; photoId: string }>(),
    { alias, refresh, session, isDemo } = useArchive();
  const [tag, setTag] = useState<Tag | null>(null),
    [record, setRecord] = useState<RecordDetails | null>(null),
    [year, setYear] = useState(''),
    [date, setDate] = useState(''),
    [reason, setReason] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    getTag(id)
      .then((t) => {
        if (!t) throw new Error('Tag not found.');
        const r = recordDetails(t, photoId);
        setTag(t);
        setRecord(r);
        setYear(r.year === null ? '' : String(r.year));
        setDate(r.takenOn || '');
      })
      .catch((e) => setError(e.message));
  }, [id, photoId]);
  const patch = (v: Partial<RecordDetails>) => setRecord((r) => (r ? { ...r, ...v } : null));
  const submit = async () => {
    if (!tag || !record) return;
    setBusy(true);
    setError('');
    try {
      await editRecord(
        tag,
        {
          ...record,
          year: record.precision === 'unknown' ? null : +year,
          takenOn: record.precision === 'exact' ? date : null,
        },
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
      <Header title="Improve a photograph’s record" />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: 22,
          gap: 18,
          width: '100%',
          maxWidth: 650,
          alignSelf: 'center',
        }}
      >
        {!!error && <Notice text={error} error />}
        {!isDemo && !session ? (
          <Button title="Sign in to edit" onPress={() => router.push('/account')} />
        ) : (
          record && (
            <>
              <Notice text="Artwork name, artist, and type apply to every photo of this artwork. Dates, captions, and photographer credit apply to this photo. All corrections are recorded; the image file is preserved." />
              <Field
                label="Artwork name"
                value={record.artworkTitle}
                onChangeText={(artworkTitle) => patch({ artworkTitle })}
                maxLength={100}
              />
              <Field
                label="Artist or alias"
                value={record.artist}
                onChangeText={(artist) => patch({ artist })}
                maxLength={100}
              />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
                {(['Piece', 'Mural', 'Lettering', 'Stencil', 'Other'] as const).map((kind) => (
                  <Chip
                    key={kind}
                    text={kind}
                    active={kind === record.kind}
                    onPress={() => patch({ kind })}
                  />
                ))}
              </View>
              <Text style={ui.label}>DATE PRECISION</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
                {(['year', 'exact', 'approximate', 'unknown'] as const).map((precision) => (
                  <Chip
                    key={precision}
                    text={
                      {
                        year: 'Year',
                        exact: 'Exact date',
                        approximate: 'Around a year',
                        unknown: 'Unknown',
                      }[precision]
                    }
                    active={record.precision === precision}
                    onPress={() => patch({ precision })}
                  />
                ))}
              </View>
              {record.precision !== 'unknown' &&
                (record.precision === 'exact' ? (
                  <Field
                    label="Photo date"
                    value={date}
                    onChangeText={(v) => {
                      setDate(v);
                      setYear(v.slice(0, 4));
                    }}
                    placeholder="YYYY-MM-DD"
                    maxLength={10}
                  />
                ) : (
                  <Field
                    label="Photo year"
                    value={year}
                    onChangeText={(v) => setYear(v.replace(/\D/g, ''))}
                    keyboardType="number-pad"
                    maxLength={4}
                  />
                ))}
              <Text style={ui.label}>CONDITION IN THIS PHOTO</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
                {(['present', 'faded', 'covered', 'gone'] as const).map((condition) => (
                  <Chip
                    key={condition}
                    text={condition}
                    active={condition === record.condition}
                    onPress={() => patch({ condition })}
                  />
                ))}
              </View>
              <Field
                label="Photographer"
                value={record.photographer}
                onChangeText={(photographer) => patch({ photographer })}
                maxLength={100}
              />
              <Field
                label="Caption"
                value={record.caption}
                onChangeText={(caption) => patch({ caption })}
                multiline
                maxLength={2000}
              />
              <Field
                label="What changed, and why?"
                value={reason}
                onChangeText={setReason}
                multiline
                maxLength={500}
              />
              <Button title="Save correction" onPress={submit} busy={busy} />
            </>
          )
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
