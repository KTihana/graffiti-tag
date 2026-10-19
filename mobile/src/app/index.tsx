import { getNativeBridge } from '../services/nativeBridge';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import ArchiveMap from '../components/ArchiveMap';
import { ArtImage, Button, Chip, Field, Icon, IconButton, Notice } from '../components/UI';
import { orderedPhotos, dateLabel, matches } from '../domain';
import { listTags } from '../services/repository';
import { findPlace } from '../services/geocode';
import { useArchive } from '../state/Archive';
import { colors, fonts, ui } from '../theme';
import { INITIAL_VIEW, type Tag } from '../types';

export default function Explore() {
  const { width } = useWindowDimensions(),
    wide = width > 800,
    insets = useSafeAreaInsets();
  const { isDemo, isPersonal, version } = useArchive();
  const [tags, setTags] = useState<Tag[]>([]),
    [target, setTarget] = useState(INITIAL_VIEW),
    [viewport, setViewport] = useState(INITIAL_VIEW);
  const [query, setQuery] = useState(''),
    [searchFocused, setSearchFocused] = useState(false),
    [kind, setKind] = useState('All'),
    [year, setYear] = useState(''),
    [filterOpen, setFilterOpen] = useState(false),
    [selected, setSelected] = useState<string | undefined>();
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [satellite, setSatellite] = useState(false),
    [locating, setLocating] = useState(false),
    [showLocation, setShowLocation] = useState(false);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      listTags(viewport, query)
        .then((data) => {
          if (active) {
            setTags(data);
            setError('');
          }
        })
        .catch((e) => active && setError(e.message))
        .finally(() => active && setLoading(false));
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [viewport, version, query]);
  const visible = useMemo(
    () => tags.filter((t) => matches(t, query, kind, year)),
    [tags, query, kind, year],
  );
  const selection = visible.find((t) => t.id === selected) || visible[0];
  const photo =
    selection &&
    orderedPhotos(selection.photos).find(
      (p) =>
        (!year || p.year === Number(year)) &&
        (kind === 'All' || selection.artworks.find((a) => a.id === p.artworkId)?.kind === kind),
    );
  const locate = async () => {
    setLocating(true);
    try {
      const native = getNativeBridge();
      const permission = native
        ? { granted: true }
        : await Location.requestForegroundPermissionsAsync();
      if (!permission.granted)
        throw new Error(
          'Location permission is off. You can still explore and place tags manually.',
        );
      const position = native
        ? { coords: await native.getLocation() }
        : await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
      setShowLocation(true);
      setTarget({ ...position.coords, latitudeDelta: 0.025, longitudeDelta: 0.025 });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLocating(false);
    }
  };
  const searchPlace = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const p = await findPlace(query);
      setTarget({ ...p, latitudeDelta: 0.05, longitudeDelta: 0.05 });
      setQuery('');
      setSelected(undefined);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  const addTag = () =>
    router.push({
      pathname: '/contribute',
      params: { lat: viewport.latitude, lng: viewport.longitude },
    });
  return (
    <View style={ui.screen}>
      <ArchiveMap
        tags={visible}
        target={target}
        selectedId={selection?.id}
        onSelect={setSelected}
        onViewport={setViewport}
        satellite={satellite}
        showLocation={showLocation}
      />
      <View
        pointerEvents="box-none"
        style={[
          s.top,
          { top: insets.top + 18, width: wide ? 370 : undefined, right: wide ? undefined : 18 },
        ]}
      >
        <View style={s.brandRow}>
          <View style={s.brandIdentity}>
            <Image
              source={require('../../assets/brand-pin.png')}
              style={s.brandLogo}
              accessibilityLabel="Graffiti Tag logo"
              resizeMode="contain"
            />
            <View style={{ flexShrink: 1 }}>
              <Text
                style={s.wordmark}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                graffiti tag<Text style={{ color: colors.green }}>.</Text>
              </Text>
              <Text style={s.tagline}>THE STREETS REMEMBER</Text>
            </View>
          </View>
          <IconButton
            icon="person-outline"
            label="Your account"
            onPress={() => router.push('/account')}
          />
        </View>
        <View style={[s.search, searchFocused && s.searchFocused]}>
          <Icon name="search" size={19} color={colors.muted} />
          <TextInput
            accessibilityLabel="Search archive or city"
            style={s.searchInput}
            placeholder="Search a city, artist, or wall"
            placeholderTextColor={colors.muted}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={searchPlace}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            returnKeyType="search"
          />
          {query ? (
            <Pressable accessibilityLabel="Clear search" onPress={() => setQuery('')}>
              <Icon name="close-circle" size={19} />
            </Pressable>
          ) : (
            <View style={s.searchDot} />
          )}
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 7 }}
        >
          <Chip
            text="All tags"
            active={kind === 'All' && !year}
            onPress={() => {
              setKind('All');
              setYear('');
            }}
            icon="apps-outline"
          />
          <Chip
            text="Pieces"
            active={kind === 'Piece'}
            onPress={() => setKind(kind === 'Piece' ? 'All' : 'Piece')}
          />
          <Chip
            text="Murals"
            active={kind === 'Mural'}
            onPress={() => setKind(kind === 'Mural' ? 'All' : 'Mural')}
          />
          <Chip
            text={year || 'Filters'}
            active={!!year || ['Lettering', 'Stencil', 'Other'].includes(kind)}
            onPress={() => setFilterOpen(true)}
            icon="options-outline"
          />
        </ScrollView>
        {tags.length >= 250 && (
          <Notice text="Showing up to 250 walls. Zoom in to explore a smaller area." />
        )}
        {query.length > 1 && (
          <Pressable style={s.searchResult} onPress={searchPlace}>
            <Icon name="location-outline" size={18} />
            <Text style={[ui.body, { flex: 1 }]}>Find “{query}” on the map</Text>
            <Icon name="arrow-forward" size={16} />
          </Pressable>
        )}
        {!!error && (
          <Pressable onPress={() => setError('')}>
            <Notice text={error} error />
          </Pressable>
        )}
      </View>
      <View style={[s.rightTools, { top: insets.top + (wide ? 24 : 190), right: 18 }]}>
        {(!Platform.OS.includes('web') || process.env.EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY) && (
          <IconButton
            icon={satellite ? 'map-outline' : 'layers-outline'}
            label={satellite ? 'Show street map' : 'Show satellite map'}
            onPress={() => setSatellite((v) => !v)}
          />
        )}
        <IconButton
          icon={locating ? 'hourglass-outline' : 'locate-outline'}
          label="Find my location"
          onPress={locate}
        />
        <IconButton
          icon="add"
          label="Zoom in"
          onPress={() =>
            setTarget({
              ...viewport,
              latitudeDelta: viewport.latitudeDelta / 2,
              longitudeDelta: viewport.longitudeDelta / 2,
            })
          }
        />
        <IconButton
          icon="remove"
          label="Zoom out"
          onPress={() =>
            setTarget({
              ...viewport,
              latitudeDelta: Math.min(170, viewport.latitudeDelta * 2),
              longitudeDelta: Math.min(350, viewport.longitudeDelta * 2),
            })
          }
        />
      </View>
      <View
        pointerEvents="box-none"
        style={[
          s.bottom,
          wide
            ? { left: 24, width: 370, bottom: 32 }
            : { left: 16, right: 16, bottom: 94 + insets.bottom },
        ]}
      >
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <View style={s.demoPill}>
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: isPersonal ? colors.green : isDemo ? '#AA812F' : colors.green,
              }}
            />
            <Text style={{ fontFamily: fonts.medium, fontSize: 10, color: colors.ink }}>
              {isPersonal
                ? 'MY PRIVATE ARCHIVE'
                : isDemo
                  ? 'LOCAL DEMO · NOT PUBLIC'
                  : 'THE COMMUNITY ARCHIVE'}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add tag"
            style={s.addButton}
            onPress={addTag}
          >
            <Icon name="add" size={18} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 13 }}>Add tag</Text>
          </Pressable>
        </View>
        <View style={s.discovery}>
          <View style={[ui.row, { justifyContent: 'space-between', marginBottom: 12 }]}>
            <View>
              <Text style={ui.label}>
                {year ? `PHOTOGRAPHED IN ${year}` : 'OUT ON THE STREETS'}
              </Text>
              <Text style={[ui.subtitle, { fontSize: 23, marginTop: 3 }]}>
                Every wall has a story.
              </Text>
            </View>
            {loading ? (
              <ActivityIndicator color={colors.green} />
            ) : (
              <View style={s.count}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 12 }}>{visible.length}</Text>
              </View>
            )}
          </View>
          {selection ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open ${selection.title}`}
              onPress={() => router.push(`/tag/${selection.id}`)}
              style={s.preview}
            >
              <ArtImage uri={photo?.uri} style={s.previewImage} />
              <View style={{ flex: 1, gap: 5 }}>
                <Text
                  numberOfLines={1}
                  style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.ink }}
                >
                  {selection.title}
                </Text>
                <Text numberOfLines={1} style={ui.muted}>
                  {selection.artworks[0]?.artist || 'Unknown artist'}
                </Text>
                <View style={[ui.row, { gap: 5 }]}>
                  <Icon name="time-outline" size={13} color={colors.green} />
                  <Text style={[ui.muted, { color: colors.green }]}>
                    {selection.photos.length} {selection.photos.length === 1 ? 'photo' : 'photos'}
                    {photo ? ` · ${dateLabel(photo)}` : ''}
                  </Text>
                </View>
              </View>
              <Icon name="arrow-forward" size={18} />
            </Pressable>
          ) : (
            <View style={{ paddingVertical: 8, gap: 7 }}>
              <Text style={ui.body}>
                {loading ? 'Finding stories…' : 'There are stories here waiting to be saved.'}
              </Text>
              <Text style={ui.muted}>
                {kind !== 'All' || year || query
                  ? 'Try another filter, or add a photograph.'
                  : 'Be the first to document a wall in this area.'}
              </Text>
            </View>
          )}
        </View>
      </View>
      <View
        style={[
          s.navigation,
          wide
            ? { left: '50%', marginLeft: -180, width: 360, bottom: 30, borderRadius: 24 }
            : { left: 0, right: 0, bottom: 0, paddingBottom: insets.bottom + 14 },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          style={s.navItem}
          accessibilityLabel="Explore"
          onPress={() => {
            setKind('All');
            setYear('');
            setQuery('');
          }}
        >
          <View style={s.activeNav}>
            <Icon name="map-outline" size={20} />
          </View>
          <Text style={s.navLabel}>Explore</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          style={s.navItem}
          onPress={() => router.push('/collection')}
        >
          <Icon name="bookmark-outline" size={21} color={colors.muted} />
          <Text style={[s.navLabel, { color: colors.muted }]}>Saved</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          style={s.navItem}
          onPress={() => router.push('/about')}
        >
          <Icon name="earth-outline" size={21} color={colors.muted} />
          <Text style={[s.navLabel, { color: colors.muted }]}>The project</Text>
        </Pressable>
      </View>
      <Modal
        visible={filterOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setFilterOpen(false)}
      >
        <View style={s.scrim}>
          <View style={[ui.card, { width: '100%', maxWidth: 430, gap: 18 }]}>
            <View style={[ui.row, { justifyContent: 'space-between' }]}>
              <Text style={ui.subtitle}>Explore the archive</Text>
              <IconButton icon="close" label="Close filters" onPress={() => setFilterOpen(false)} />
            </View>
            <Text style={ui.label}>Artwork type</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {['All', 'Piece', 'Mural', 'Lettering', 'Stencil', 'Other'].map((k) => (
                <Chip key={k} text={k} active={kind === k} onPress={() => setKind(k)} />
              ))}
            </View>
            <Field
              label="Year photographed"
              value={year}
              onChangeText={(v) => setYear(v.replace(/\D/g, '').slice(0, 4))}
              keyboardType="number-pad"
              placeholder="Any year"
              hint="Filters photographs by their recorded year. Approximate dates are included; unknown dates are excluded when a year is selected."
            />
            <Button title="Show tags" onPress={() => setFilterOpen(false)} />
            <Button
              title="Reset filters"
              secondary
              onPress={() => {
                setYear('');
                setKind('All');
                setFilterOpen(false);
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
const s = StyleSheet.create({
  top: { position: 'absolute', left: 18, gap: 11 },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAF5F5',
    padding: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
  },
  brandIdentity: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 },
  brandLogo: { width: 32, height: 39 },
  wordmark: { fontFamily: fonts.display, fontSize: 25, letterSpacing: -1.5, color: colors.ink },
  tagline: {
    fontFamily: fonts.medium,
    fontSize: 8,
    letterSpacing: 1.8,
    color: colors.muted,
    marginTop: 1,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 53,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 17,
    backgroundColor: colors.white,
    gap: 10,
  },
  searchFocused: { borderWidth: 2, borderColor: colors.green },
  searchInput: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.ink,
    height: '100%',
  },
  searchDot: { width: 7, height: 7, backgroundColor: colors.lime, borderRadius: 4 },
  searchResult: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  rightTools: { position: 'absolute', gap: 8 },
  bottom: { position: 'absolute' },
  demoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#FFFFFFF2',
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 20,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 17,
    height: 44,
    borderRadius: 24,
    backgroundColor: colors.lime,
    borderWidth: 1,
    borderColor: '#C5DF5D',
  },
  discovery: {
    borderRadius: 22,
    padding: 18,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    boxShadow: '0 6px 30px #20251f18',
  },
  count: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: colors.lime,
    borderRadius: 12,
  },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: colors.line,
  },
  previewImage: { width: 78, height: 76, borderRadius: 13 },
  navigation: {
    position: 'absolute',
    backgroundColor: colors.paper,
    borderTopWidth: 1,
    borderColor: colors.line,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 12,
    minHeight: 74,
  },
  navItem: { alignItems: 'center', justifyContent: 'center', gap: 5, width: 80 },
  activeNav: {
    backgroundColor: colors.lime,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 4,
  },
  navLabel: { fontFamily: fonts.bold, color: colors.ink, fontSize: 10 },
  scrim: {
    flex: 1,
    backgroundColor: '#151C1777',
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
