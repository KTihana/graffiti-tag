import { artworkKinds } from '../../categories';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Share,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArtImage, Button, Chip, Header, Icon, IconButton, Notice } from '../../components/UI';
import { dateLabel, orderedPhotos } from '../../domain';
import { getTag } from '../../services/repository';
import { useArchive } from '../../state/Archive';
import { colors, fonts, ui } from '../../theme';
import type { Photo, Tag } from '../../types';
import PieceActions from '../../components/PieceActions';
export default function TagDetail() {
  const { id, artworkId } = useLocalSearchParams<{ id: string; artworkId?: string }>(),
    { version, saved, toggleSaved, isDemo, isPersonal } = useArchive();
  const [tag, setTag] = useState<Tag | null>(null),
    [error, setError] = useState(''),
    [loaded, setLoaded] = useState(false),
    [activeArt, setActiveArt] = useState(artworkId || 'all'),
    [fullPhoto, setFullPhoto] = useState<Photo | null>(null);
  useEffect(() => {
    let active = true;
    getTag(id)
      .then((t) => {
        if (active) {
          setTag(t);
          setLoaded(true);
        }
      })
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [id, version]);
  const safe = async (action: () => Promise<unknown>) => {
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  if (!tag)
    return (
      <SafeAreaView style={ui.screen}>
        <Header title="Wall archive" />
        <View style={{ padding: 24 }}>
          {error ? (
            <Notice text={error} error />
          ) : loaded ? (
            <Notice text="This tag could not be found. It may have been merged or removed." />
          ) : (
            <ActivityIndicator />
          )}
        </View>
      </SafeAreaView>
    );
  const photos = orderedPhotos(tag.photos).filter(
      (p) => activeArt === 'all' || p.artworkId === activeArt,
    ),
    years = tag.photos.flatMap((p) => (p.year === null ? [] : [p.year]));
  return (
    <SafeAreaView style={ui.screen} edges={['top', 'bottom']}>
      <Header
        title="The wall archive"
        subtitle={
          isPersonal
            ? 'My personal collection'
            : isDemo
              ? 'Local demo collection'
              : 'A living community record'
        }
        right={
          <IconButton
            icon={saved.includes(id) ? 'bookmark' : 'bookmark-outline'}
            label={saved.includes(id) ? 'Unsave tag' : 'Save tag'}
            onPress={() => safe(() => toggleSaved(id))}
          />
        }
      />
      <ScrollView
        contentContainerStyle={{
          width: '100%',
          maxWidth: 760,
          alignSelf: 'center',
          paddingBottom: 32,
        }}
      >
        <Pressable onPress={() => setFullPhoto(photos[0])}>
          <ArtImage uri={photos[0]?.uri} style={{ width: '100%', height: 280 }} />
          <View
            style={{
              position: 'absolute',
              bottom: 15,
              left: 20,
              backgroundColor: colors.lime,
              borderRadius: 20,
              paddingHorizontal: 12,
              paddingVertical: 7,
            }}
          >
            <Text style={{ fontFamily: fonts.bold, fontSize: 11 }}>
              {photos[0] ? dateLabel(photos[0]) : 'No photograph'}
            </Text>
          </View>
        </Pressable>
        <View style={{ padding: 22, gap: 16 }}>
          {!!error && <Notice text={error} error />}
          <Text style={ui.label}>
            {tag.artworks.length} ARTWORK{tag.artworks.length !== 1 ? 'S' : ''} ·{' '}
            {tag.photos.length} PHOTOGRAPH{tag.photos.length !== 1 ? 'S' : ''}
          </Text>
          <Text style={ui.title}>{tag.title}</Text>
          <View style={ui.row}>
            <Icon name="location-outline" size={16} color={colors.green} />
            <Text style={ui.muted}>
              {tag.latitude.toFixed(5)}, {tag.longitude.toFixed(5)}
            </Text>
          </View>
          <Text style={ui.body}>
            {tag.description ||
              'A wall worth remembering. Help tell its story by adding a photograph.'}
          </Text>
          {tag.demo && (
            <Notice text="Sample record: these dates, locations, and artwork names demonstrate the app. They are not verified history. Photo attribution appears below each image." />
          )}
          <Button
            title="Add to this wall’s history"
            icon="camera-outline"
            onPress={() => router.push({ pathname: '/contribute', params: { tagId: tag.id } })}
          />
          <View style={ui.row}>
            <Button
              title="Directions"
              secondary
              icon="navigate-outline"
              style={{ flex: 1 }}
              onPress={() =>
                safe(() =>
                  Linking.openURL(
                    `https://www.google.com/maps/dir/?api=1&destination=${tag.latitude},${tag.longitude}`,
                  ),
                )
              }
            />
            <IconButton
              icon="share-outline"
              label="Share this tag"
              onPress={() =>
                safe(() =>
                  Share.share({
                    message: `${tag.title} | Graffiti Tag\n${isPersonal ? 'From my personal graffiti archive' : isDemo ? 'Local demo tag (not a public record)' : `graffititag://tag/${tag.id}`}\n${tag.latitude}, ${tag.longitude}`,
                  }),
                )
              }
            />
            <IconButton
              icon="create-outline"
              label="Edit this tag"
              onPress={() => router.push({ pathname: '/edit', params: { id } })}
            />
          </View>
          <Button title="Your saved graffiti" secondary icon="albums-outline" onPress={() => router.push('/collection')} />
          <View style={ui.divider} />
          <Text style={ui.subtitle}>The pieces on this wall</Text>
          {tag.artworks.filter((a) => activeArt === 'all' || a.id === activeArt).map((a) => (
            <View key={a.id} style={[ui.card, { gap: 12 }]}>
              <Text style={ui.subtitle}>{a.title}</Text>
              <Text style={ui.muted}>By {a.artist} · {artworkKinds(a).join(' · ')}</Text>
              <PieceActions artworkId={a.id} tagId={tag.id} title={a.title} />
            </View>
          ))}
          <View style={[ui.row, { justifyContent: 'space-between' }]}>
            <Text style={ui.subtitle}>Layers of history</Text>
            <Text style={ui.muted}>
              {years.length ? `${Math.min(...years)} to ${Math.max(...years)}` : 'Dates unknown'}
            </Text>
          </View>
          <Text style={ui.muted}>
            Photographs are ordered by when they were taken. A sighting records that moment, not how
            the wall looks today.
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 7 }}
          >
            <Chip
              text="All artworks"
              active={activeArt === 'all'}
              onPress={() => setActiveArt('all')}
            />
            {tag.artworks.map((a) => (
              <Chip
                key={a.id}
                text={a.title}
                active={activeArt === a.id}
                onPress={() => setActiveArt(a.id)}
              />
            ))}
          </ScrollView>
          {photos.map((p) => {
            const art = tag.artworks.find((a) => a.id === p.artworkId);
            return (
              <View
                key={p.id}
                style={{
                  borderLeftWidth: 2,
                  borderColor: colors.line,
                  marginLeft: 5,
                  paddingLeft: 20,
                  paddingBottom: 16,
                  gap: 10,
                }}
              >
                <View
                  style={{
                    position: 'absolute',
                    left: -6,
                    top: 4,
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: colors.green,
                  }}
                />
                <View style={[ui.row, { justifyContent: 'space-between' }]}>
                  <Text style={[ui.subtitle, { fontSize: 19 }]}>{dateLabel(p)}</Text>
                  <Text style={[ui.muted, { textTransform: 'capitalize' }]}>
                    {p.condition} when photographed
                  </Text>
                </View>
                <Pressable
                  accessibilityLabel={`View photograph from ${dateLabel(p)}`}
                  onPress={() => setFullPhoto(p)}
                >
                  <ArtImage uri={p.uri} style={{ width: '100%', height: 200, borderRadius: 16 }} />
                </Pressable>
                <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.ink }}>
                  {art?.title || 'Untitled'}
                </Text>
                <Text style={ui.muted}>
                  {art?.artist || 'Unknown artist'} · {art ? artworkKinds(art).join(' · ') : ''}
                </Text>
                {!!p.caption && <Text style={ui.body}>{p.caption}</Text>}
                <Text style={ui.muted}>
                  Photograph: {p.photographer} · Added by {p.contributor}
                  {'\n'}Uploaded {new Date(p.uploadedAt).toLocaleDateString('en-GB')}
                </Text>
                {p.sourceUrl && (
                  <Pressable onPress={() => safe(() => Linking.openURL(p.sourceUrl!))}>
                    <Text style={[ui.muted, { textDecorationLine: 'underline' }]}>
                      {p.license} · Wikimedia Commons · View source
                    </Text>
                  </Pressable>
                )}
                <Button
                  title="Correct photo or artwork details"
                  secondary
                  icon="create-outline"
                  onPress={() =>
                    router.push({ pathname: '/edit-record', params: { id: tag.id, photoId: p.id } })
                  }
                />
              </View>
            );
          })}
          <View style={ui.row}>
            <Button
              title="Edit history"
              secondary
              icon="time-outline"
              style={{ flex: 1 }}
              onPress={() => router.push({ pathname: '/history', params: { id } })}
            />
            <Button
              title="Report"
              secondary
              icon="flag-outline"
              onPress={() => router.push({ pathname: '/report', params: { id } })}
            />
          </View>
        </View>
      </ScrollView>
      <Modal visible={!!fullPhoto} animationType="fade" onRequestClose={() => setFullPhoto(null)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.ink }}>
          <View style={{ padding: 18, alignItems: 'flex-end' }}>
            <IconButton icon="close" label="Close photo" onPress={() => setFullPhoto(null)} />
          </View>
          <ArtImage contain uri={fullPhoto?.uri} style={{ flex: 1, width: '100%' }} />
          <View style={{ padding: 24, gap: 7 }}>
            <Text style={[ui.subtitle, { color: colors.white }]}>
              {fullPhoto && dateLabel(fullPhoto)}
            </Text>
            <Text style={[ui.body, { color: '#D0D6C7' }]}>{fullPhoto?.caption}</Text>
            <Text style={[ui.muted, { color: '#D0D6C7' }]}>
              Photograph: {fullPhoto?.photographer}
            </Text>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
