import React, { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Crypto from 'expo-crypto';
import ArchiveMap from '../components/ArchiveMap';
import UserLocationStatus from '../components/UserLocationStatus';
import { ArtImage, Button, Chip, Field, Header, Icon, Notice } from '../components/UI';
import { distanceMeters, validateContribution } from '../domain';
import { getNativeBridge, type NativePhoto } from '../services/nativeBridge';
import { contribute, getTag, listTags } from '../services/repository';
import { useArchive } from '../state/Archive';
import { useUserLocation } from '../state/UserLocation';
import { colors, ui } from '../theme';
import { INITIAL_VIEW, type Contribution, type Tag } from '../types';
export default function Contribute() {
  const params = useLocalSearchParams<{ tagId?: string; lat?: string; lng?: string }>(),
    { isDemo, isPersonal, session, alias, refresh } = useArchive();
  const { position, locating, locate: findLocation, error: locationError, dismissError } = useUserLocation();
  const [c, setC] = useState<Contribution>({
    tagId: params.tagId,
    title: '',
    description: '',
    point: {
      latitude: params.lat ? +params.lat : INITIAL_VIEW.latitude,
      longitude: params.lng ? +params.lng : INITIAL_VIEW.longitude,
    },
    artworkTitle: 'Untitled',
    artist: '',
    kind: 'Piece',
    imageUri: '',
    mimeType: 'image/jpeg',
    year: '',
    takenOn: '',
    precision: 'year',
    condition: 'present',
    caption: '',
    photographer: '',
    rightsConfirmed: isPersonal,
  });
  const [step, setStep] = useState(0),
    [existing, setExisting] = useState<Tag | null>(null),
    [nearby, setNearby] = useState<Tag[]>([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [confirmedLocation, setConfirmedLocation] = useState(!!params.tagId),
    [target, setTarget] = useState({ ...c.point, latitudeDelta: 0.012, longitudeDelta: 0.012 });
  const patch = (update: Partial<Contribution>) => setC((prev) => ({ ...prev, ...update }));
  const applyPhoto = useCallback((
    asset: { uri: string; mimeType?: string; exif?: NativePhoto['exif'] | null },
    camera: boolean,
  ) => {
    const update: Partial<Contribution> = {
      imageUri: asset.uri,
      mimeType: asset.mimeType || 'image/jpeg',
      submissionId: Crypto.randomUUID(),
    };
    const exifDate = asset.exif?.DateTimeOriginal || asset.exif?.DateTime;
    const date = typeof exifDate === 'string' ? exifDate.slice(0, 10).replace(/:/g, '-') : '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      update.year = date.slice(0, 4);
      update.takenOn = date;
      update.precision = 'exact';
    } else if (camera) {
      const now = new Date();
      const d = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      update.year = d.slice(0, 4);
      update.takenOn = d;
      update.precision = 'exact';
    }
    const lat = asset.exif?.GPSLatitude,
      lng = asset.exif?.GPSLongitude;
    if (!c.tagId && typeof lat === 'number' && typeof lng === 'number') {
      update.point = {
        latitude: asset.exif?.GPSLatitudeRef === 'S' ? -Math.abs(lat) : lat,
        longitude: asset.exif?.GPSLongitudeRef === 'W' ? -Math.abs(lng) : lng,
      };
      setTarget({ ...update.point, latitudeDelta: 0.01, longitudeDelta: 0.01 });
      setConfirmedLocation(false);
    }
    setC((prev) => ({ ...prev, ...update }));
    setError('');
  }, [c.tagId]);
  useEffect(() => {
    const native = getNativeBridge();
    if (!native) return;
    let active = true;
    const onRestoredPhoto = (event: Event) => {
      const photo = (event as CustomEvent<NativePhoto>).detail;
      if (photo?.uri) {
        native.consumeRestoredPhoto?.();
        applyPhoto(photo, true);
      }
    };
    window.addEventListener('graffiti-native-photo-restored', onRestoredPhoto);
    const restoredPhoto = native.consumeRestoredPhoto?.();
    if (restoredPhoto) queueMicrotask(() => active && applyPhoto(restoredPhoto, true));
    return () => {
      active = false;
      window.removeEventListener('graffiti-native-photo-restored', onRestoredPhoto);
    };
  }, [applyPhoto]);
  useEffect(() => {
    let active = true;
    if (params.tagId)
      getTag(params.tagId)
        .then((t) => {
          if (active && t) {
            setExisting(t);
            setC((prev) => ({
              ...prev,
              tagId: t.id,
              point: { latitude: t.latitude, longitude: t.longitude },
            }));
            setTarget({ ...t, latitudeDelta: 0.008, longitudeDelta: 0.008 });
          }
        })
        .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [params.tagId]);
  useEffect(() => {
    let active = true;
    listTags({ ...c.point, latitudeDelta: 0.01, longitudeDelta: 0.01 })
      .then((tags) => active && setNearby(tags.filter((t) => distanceMeters(c.point, t) < 200)))
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [c.point]);
  const choose = async (camera: boolean) => {
    try {
      const native = getNativeBridge();
      if (camera && !native) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted)
          throw new Error(
            'Camera permission is off. You can choose an existing photograph instead.',
          );
      }
      if (camera && native) {
        try {
          localStorage.setItem(
            'graffiti-native-camera-route',
            `${window.location.pathname}${window.location.search}${window.location.hash}`,
          );
        } catch {
          // Photo recovery still works when WebView storage is unavailable.
        }
      }
      const result = native
        ? { canceled: false, assets: [await native.takePhoto(camera)] }
        : camera
          ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1, exif: true })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              quality: 1,
              exif: true,
            });
      if (camera && native) {
        try {
          localStorage.removeItem('graffiti-native-camera-route');
        } catch {
          // Storage is only a fallback for restoring the route after process death.
        }
      }
      if (result.canceled) return;
      const asset = result.assets[0];
      applyPhoto(asset, camera);
    } catch (e) {
      if (camera && getNativeBridge()) {
        try {
          localStorage.removeItem('graffiti-native-camera-route');
        } catch {
          // Storage is only a fallback for restoring the route after process death.
        }
      }
      if (!/cancel/i.test((e as Error).message)) setError((e as Error).message);
    }
  };
  const locate = async () => {
    const next = await findLocation();
    if (!next) return;
    patch({ point: { latitude: next.latitude, longitude: next.longitude } });
    setTarget({ ...next, latitudeDelta: 0.003, longitudeDelta: 0.003 });
    setConfirmedLocation(false);
  };
  const selectWall = (t: Tag) => {
    setExisting(t);
    patch({
      tagId: t.id,
      artworkId: undefined,
      point: { latitude: t.latitude, longitude: t.longitude },
    });
    setConfirmedLocation(true);
    setTarget({ ...t, latitudeDelta: 0.008, longitudeDelta: 0.008 });
  };
  const next = () => {
    if (!step && !c.imageUri) return setError('Choose a photograph first.');
    if (step === 1 && !confirmedLocation)
      return setError('Confirm that the pin marks the wall, not where you were standing.');
    if (step === 1 && !c.tagId && c.title.trim().length < 3)
      return setError('Give the wall a short name.');
    setError('');
    setStep((v) => v + 1);
  };
  const publish = async () => {
    const validation = validateContribution(c);
    if (validation) return setError(validation);
    setBusy(true);
    setError('');
    try {
      const id = await contribute(c, alias);
      refresh();
      router.dismissTo(`/tag/${id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (!isDemo && !session)
    return (
      <SafeAreaView style={ui.screen}>
        <Header title="Contribute a photograph" />
        <View style={{ padding: 24, gap: 20 }}>
          <Text style={ui.title}>A shared archive.{'\n'}A little accountability.</Text>
          <Text style={ui.body}>
            Sign in to add photographs and edit records. Your public alias appears in the
            contribution history.
          </Text>
          <Button title="Sign in to contribute" onPress={() => router.push('/account')} />
        </View>
      </SafeAreaView>
    );
  return (
    <SafeAreaView style={ui.screen} edges={['top', 'bottom']}>
      <Header
        title="Keep a piece of the street"
        subtitle={`STEP ${step + 1} OF 3 · ${['THE PHOTOGRAPH', 'THE WALL', 'THE STORY'][step]}`}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            padding: 22,
            gap: 20,
            maxWidth: 650,
            width: '100%',
            alignSelf: 'center',
          }}
        >
          <View style={[ui.row, { gap: 5 }]}>
            {[0, 1, 2].map((i) => (
              <View
                key={i}
                style={{
                  flex: 1,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: i <= step ? colors.green : colors.line,
                }}
              />
            ))}
          </View>
          {isDemo && !isPersonal && (
            <Notice text="Local demo: contributions stay on this device and are not public." />
          )}
          {!!error && <Notice text={error} error />}
          {step === 0 && (
            <>
              <Pressable
                accessibilityLabel="Choose a photograph"
                onPress={() => choose(false)}
                style={{
                  borderWidth: 1,
                  borderStyle: 'dashed',
                  borderColor: '#B7C3A4',
                  backgroundColor: colors.soft,
                  borderRadius: 20,
                  overflow: 'hidden',
                  minHeight: 240,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                {c.imageUri ? (
                  <ArtImage uri={c.imageUri} style={{ width: '100%', height: 260 }} />
                ) : (
                  <View style={{ alignItems: 'center', gap: 15, padding: 16 }}>
                    <Icon name="images-outline" size={44} color={colors.green} />
                    <Text style={[ui.muted, { textAlign: 'center' }]}>
                      Tap to choose from your gallery
                    </Text>
                  </View>
                )}
              </Pressable>
              <View style={[ui.row, { alignItems: 'stretch' }]}>
                <Button
                  title="Take photo"
                  icon="camera-outline"
                  secondary
                  style={{ flex: 1 }}
                  onPress={() => choose(true)}
                />
                <Button
                  title="Choose photo"
                  icon="image-outline"
                  secondary
                  style={{ flex: 1 }}
                  onPress={() => choose(false)}
                />
              </View>
              <Text style={ui.muted}>
                We keep the original file and create a smaller browsing copy. One photograph per
                contribution; add more to the same artwork anytime.
              </Text>
            </>
          )}
          {step === 1 && (
            <>
              <Text style={ui.title}>
                {existing ? 'Another chapter.\nThe same wall.' : 'Where is the wall?'}
              </Text>
              <Text style={ui.body}>
                Tap the map to place the tag on the artwork’s surface. Nearby tags help keep one
                wall’s history together.
              </Text>
              <View style={{ height: 280, borderRadius: 20, overflow: 'hidden' }}>
                <ArchiveMap
                  tags={nearby}
                  target={target}
                  onSelect={(id) => {
                    const t = nearby.find((x) => x.id === id);
                    if (t) selectWall(t);
                  }}
                  pick={c.point}
                  userLocation={position}
                  onPick={
                    c.tagId
                      ? undefined
                      : (p) => {
                          patch({ point: p });
                          setConfirmedLocation(false);
                        }
                  }
                />
              </View>
              <UserLocationStatus position={position} />
              <Text style={ui.muted}>
                {c.point.latitude.toFixed(5)}, {c.point.longitude.toFixed(5)}
              </Text>
              {!c.tagId && (
                <Button
                  title="Use my location as a starting point"
                  secondary
                  icon="locate-outline"
                  onPress={locate}
                  busy={locating}
                />
              )}
              <Text style={ui.muted}>Location access is optional. You can place the pin manually.</Text>
              {!!locationError && (
                <Pressable accessibilityRole="button" accessibilityLabel="Dismiss location message" onPress={dismissError}>
                  <Notice text={locationError} error />
                </Pressable>
              )}
              {existing ? (
                <View style={[ui.card, { gap: 12 }]}>
                  <Text style={ui.label}>ADDING TO AN EXISTING TAG</Text>
                  <Text style={ui.subtitle}>{existing.title}</Text>
                  <Button
                    title="This is a different wall"
                    secondary
                    onPress={() => {
                      setExisting(null);
                      patch({ tagId: undefined, artworkId: undefined });
                      setConfirmedLocation(false);
                    }}
                  />
                </View>
              ) : (
                <>
                  <Field
                    label="Wall name"
                    value={c.title}
                    onChangeText={(title) => patch({ title })}
                    placeholder="e.g. Railway wall, east side"
                    maxLength={100}
                  />
                  <Field
                    label="About this wall (optional)"
                    value={c.description}
                    onChangeText={(description) => patch({ description })}
                    multiline
                    placeholder="A useful landmark or a little context…"
                    maxLength={2000}
                  />
                  {nearby.length > 0 && (
                    <View style={{ gap: 10 }}>
                      <Text style={ui.label}>COULD IT BE ONE OF THESE?</Text>
                      {nearby.map((t) => (
                        <Pressable
                          key={t.id}
                          onPress={() => selectWall(t)}
                          style={[ui.card, ui.row, { padding: 14 }]}
                        >
                          <Icon name="location-outline" />
                          <View style={{ flex: 1 }}>
                            <Text style={ui.body}>{t.title}</Text>
                            <Text style={ui.muted}>
                              {Math.round(distanceMeters(c.point, t))} m from your pin
                            </Text>
                          </View>
                          <Icon name="add-circle-outline" />
                        </Pressable>
                      ))}
                    </View>
                  )}
                </>
              )}
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: confirmedLocation }}
                aria-checked={confirmedLocation}
                accessibilityLabel="Confirm wall location"
                onPress={() => setConfirmedLocation((v) => !v)}
                style={ui.row}
              >
                <Icon
                  name={confirmedLocation ? 'checkbox' : 'square-outline'}
                  color={colors.green}
                  size={25}
                />
                <Text style={[ui.body, { flex: 1 }]}>This pin marks the wall’s location.</Text>
              </Pressable>
            </>
          )}
          {step === 2 && (
            <>
              <Text style={ui.title}>Give it a place in history.</Text>
              {existing && (
                <>
                  <Text style={ui.label}>SAME ARTWORK OR A NEW LAYER?</Text>
                  <View style={{ gap: 8 }}>
                    {existing.artworks.map((a) => (
                      <Chip
                        key={a.id}
                        text={`${a.title} · ${a.artist}`}
                        active={c.artworkId === a.id}
                        onPress={() => patch({ artworkId: a.id })}
                      />
                    ))}
                    <Chip
                      text="A different artwork on this wall"
                      active={!c.artworkId}
                      onPress={() => patch({ artworkId: undefined })}
                    />
                  </View>
                </>
              )}
              {!c.artworkId && (
                <>
                  <Field
                    label="Artwork name"
                    value={c.artworkTitle}
                    onChangeText={(artworkTitle) => patch({ artworkTitle })}
                    maxLength={100}
                  />
                  <Field
                    label="Artist or alias (optional)"
                    value={c.artist}
                    onChangeText={(artist) => patch({ artist })}
                    placeholder="Unknown is okay"
                    maxLength={100}
                  />
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
                    {(['Piece', 'Mural', 'Lettering', 'Stencil', 'Other'] as const).map((kind) => (
                      <Chip
                        key={kind}
                        text={kind}
                        active={c.kind === kind}
                        onPress={() => patch({ kind })}
                      />
                    ))}
                  </View>
                </>
              )}
              <Text style={ui.label}>WHEN WAS THE PHOTO TAKEN?</Text>
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
                    active={c.precision === precision}
                    onPress={() => patch({ precision })}
                  />
                ))}
              </View>
              {c.precision !== 'unknown' &&
                (c.precision === 'exact' ? (
                  <Field
                    label="Photo date"
                    value={c.takenOn}
                    onChangeText={(takenOn) => patch({ takenOn, year: takenOn.slice(0, 4) })}
                    placeholder="YYYY-MM-DD"
                    maxLength={10}
                    hint="Confirm the date, even if it was suggested from your photo."
                  />
                ) : (
                  <Field
                    label="Photo year"
                    value={c.year}
                    onChangeText={(year) => patch({ year: year.replace(/\D/g, '') })}
                    placeholder="e.g. 2007"
                    keyboardType="number-pad"
                    maxLength={4}
                  />
                ))}
              <Text style={ui.label}>CONDITION IN THIS PHOTOGRAPH</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
                {(['present', 'faded', 'covered', 'gone'] as const).map((condition) => (
                  <Chip
                    key={condition}
                    text={condition[0].toUpperCase() + condition.slice(1)}
                    active={c.condition === condition}
                    onPress={() => patch({ condition })}
                  />
                ))}
              </View>
              <Field
                label="Photographer (optional)"
                value={c.photographer}
                onChangeText={(photographer) => patch({ photographer })}
                placeholder={alias}
                maxLength={100}
              />
              <Field
                label="The story (optional)"
                value={c.caption}
                onChangeText={(caption) => patch({ caption })}
                placeholder="What do you remember about this piece?"
                multiline
                maxLength={2000}
              />
              {!isPersonal && (
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: c.rightsConfirmed }}
                  accessibilityLabel="Confirm photo sharing permission"
                  onPress={() => patch({ rightsConfirmed: !c.rightsConfirmed })}
                  style={[ui.row, { alignItems: 'flex-start' }]}
                >
                  <Icon
                    name={c.rightsConfirmed ? 'checkbox' : 'square-outline'}
                    color={colors.green}
                    size={25}
                  />
                  <Text style={[ui.body, { flex: 1 }]}>
                    I took this photo or have permission to share it, and allow Graffiti Tag to
                    store and display it publicly with credit.
                  </Text>
                </Pressable>
              )}
            </>
          )}
          <View style={[ui.row, { marginTop: 6 }]}>
            {step > 0 && (
              <Button
                title="Back"
                secondary
                disabled={busy}
                onPress={() => {
                  setError('');
                  setStep((v) => v - 1);
                }}
              />
            )}
            <Button
              title={
                step === 2
                  ? isPersonal
                    ? 'Save photograph'
                    : isDemo
                      ? 'Save to local demo'
                      : 'Publish photograph'
                  : 'Continue'
              }
              icon={step === 2 ? 'checkmark' : 'arrow-forward'}
              busy={busy}
              style={{ flex: 1 }}
              onPress={step === 2 ? publish : next}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
