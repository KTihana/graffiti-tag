import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArtImage, Header, Icon, Notice } from '../components/UI';
import { coverPhoto } from '../domain';
import { getTag } from '../services/repository';
import { useArchive } from '../state/Archive';
import { ui } from '../theme';
import type { Tag } from '../types';
export default function Collection() {
  const { saved, version } = useArchive();
  const [tags, setTags] = useState<Tag[]>([]),
    [error, setError] = useState('');
  useEffect(() => {
    Promise.all(saved.map(getTag))
      .then((all) => setTags(all.filter((x): x is Tag => !!x)))
      .catch((e) => setError(e.message));
  }, [saved, version]);
  return (
    <SafeAreaView style={ui.screen}>
      <Header title="Your saved walls" subtitle="Bookmarks are saved on this device" />
      <ScrollView
        contentContainerStyle={{
          padding: 22,
          gap: 16,
          width: '100%',
          maxWidth: 650,
          alignSelf: 'center',
        }}
      >
        <Text style={ui.title}>Worth coming back to.</Text>
        {!!error && <Notice text={error} error />}
        {!saved.length && <Notice text="Open a tag and tap the bookmark to save it here." />}
        {tags.map((t) => (
          <Pressable
            key={t.id}
            onPress={() => router.push(`/tag/${t.id}`)}
            style={[ui.card, { padding: 12, flexDirection: 'row', gap: 15, alignItems: 'center' }]}
          >
            <ArtImage
              uri={coverPhoto(t)?.uri}
              style={{ width: 85, height: 85, borderRadius: 13 }}
            />
            <View style={{ flex: 1, gap: 7 }}>
              <Text style={[ui.subtitle, { fontSize: 18 }]}>{t.title}</Text>
              <Text style={ui.muted}>
                {t.photos.length} photographs · {t.artworks.length} artworks
              </Text>
            </View>
            <Icon name="arrow-forward" />
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
