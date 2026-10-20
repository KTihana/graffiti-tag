import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArtImage, Button, Chip, Field, Header, Icon, Notice } from '../components/UI';
import PieceActions, { CollectionForm } from '../components/PieceActions';
import { coverPhoto, orderedPhotos } from '../domain';
import { getTag } from '../services/repository';
import { useArchive } from '../state/Archive';
import { useSocial } from '../state/Social';
import { colors, ui } from '../theme';
import type { Tag } from '../types';

export default function Collection() {
  const { saved, version, isDemo, session } = useArchive();
  const { data, ready, busy, error: loadError, act } = useSocial();
  const [tags, setTags] = useState<Tag[]>([]), [error, setError] = useState(''),
    [selected, setSelected] = useState('all'), [creating, setCreating] = useState(false),
    [editing, setEditing] = useState(false), [name, setName] = useState(''), [confirmDelete, setConfirmDelete] = useState(false),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    const ids = [...new Set([...saved, ...data.pieces.map((p) => p.tagId)])];
    Promise.all(ids.map(getTag)).then((all) => {
      if (active) { setTags(all.filter((x): x is Tag => !!x)); setError(''); }
    }).catch((e) => active && setError(e.message)).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [saved, data.pieces, version]);
  const collection = data.collections.find((c) => c.id === selected);
  const pieces = data.pieces.filter((p) => selected === 'all' || collection?.artworkIds.includes(p.artworkId));
  const run = async (action: Parameters<typeof act>[0]) => {
    try { await act(action); setEditing(false); setConfirmDelete(false); setError(''); return true; }
    catch (e) { setError((e as Error).message); return false; }
  };
  return <SafeAreaView style={ui.screen}>
    <Header title="Your saved graffiti" subtitle={isDemo ? 'Private · Saved on this device' : 'Your private collections'} />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 22, gap: 16, width: '100%', maxWidth: 650, alignSelf: 'center' }}>
      <Text style={ui.title}>Worth coming back to.</Text>
      <Text style={ui.body}>Your favourite pieces, in collections of your own.</Text>
      {!!(error || loadError) && <Notice text={error || loadError} error />}
      {!isDemo && !session && <Button title="Sign in to save graffiti" onPress={() => router.push('/account')} />}
      <Button title="New collection" secondary icon="add-outline" disabled={!ready || busy || (!isDemo && !session)} onPress={() => setCreating(true)} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        <Chip text={`All saved (${data.pieces.length})`} active={selected === 'all'} onPress={() => { setSelected('all'); setEditing(false); setConfirmDelete(false); }} />
        {data.collections.map((c) => <Chip key={c.id} text={`${c.name} (${c.artworkIds.length})`} icon="albums-outline" active={selected === c.id}
          onPress={() => { setSelected(c.id); setEditing(false); setConfirmDelete(false); }} />)}
      </ScrollView>
      {collection && <View style={[ui.card, { gap: 12 }]}>
        <Text style={ui.subtitle}>{collection.name}</Text>
        <View style={[ui.row, { flexWrap: 'wrap' }]}>
          <Button title="Rename collection" secondary onPress={() => { setName(collection.name); setEditing(true); setConfirmDelete(false); }} />
          <Button title="Delete collection" secondary onPress={() => { setConfirmDelete(true); setEditing(false); }} />
        </View>
        {editing && <>
          <Field label="New collection name" maxLength={60} value={name} onChangeText={setName} />
          <Button title="Save collection name" disabled={busy || !name.trim()} onPress={() => run({ kind: 'rename', collectionId: collection.id, name })} />
          <Button title="Cancel rename" secondary onPress={() => setEditing(false)} />
        </>}
        {confirmDelete && <>
          <Text style={ui.body}>Delete “{collection.name}”? Its pieces will stay in All saved.</Text>
          <Button title="Confirm delete collection" disabled={busy} onPress={async () => { if (await run({ kind: 'delete', collectionId: collection.id })) setSelected('all'); }} />
          <Button title="Keep collection" secondary onPress={() => setConfirmDelete(false)} />
        </>}
      </View>}
      {(!ready || loading) && !loadError && <ActivityIndicator accessibilityLabel="Loading saved graffiti" />}
      {ready && !loading && !pieces.length && <Notice text={collection ? 'No pieces here yet. Open a piece, tap Save piece, and choose this collection.' : 'Find a piece you love and tap Save piece. You can organize it into collections whenever you like.'} />}
      {pieces.map((piece) => {
        const tag = tags.find((t) => t.id === piece.tagId), art = tag?.artworks.find((a) => a.id === piece.artworkId);
        if (!tag || !art) return null;
        return <View key={piece.artworkId} style={[ui.card, { gap: 12 }]}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Open piece ${art.title}`} onPress={() => router.push({ pathname: '/tag/[id]', params: { id: tag.id, artworkId: art.id } })} style={{ gap: 10 }}>
            <ArtImage uri={orderedPhotos(tag.photos).find((p) => p.artworkId === art.id)?.uri} style={{ width: '100%', height: 190, borderRadius: 14 }} />
            <Text style={ui.subtitle}>{art.title}</Text>
            <Text style={ui.muted}>{art.artist} · {tag.title}</Text>
          </Pressable>
          <PieceActions artworkId={art.id} tagId={tag.id} title={art.title} />
          {collection && <Button title="Remove from this collection" secondary disabled={busy} onPress={() => run({ kind: 'membership', collectionId: collection.id, artworkId: art.id, enabled: false })} />}
        </View>;
      })}
      {selected === 'all' && !!saved.length && <>
        <View style={ui.divider} />
        <Text style={ui.subtitle}>Saved walls</Text>
        {tags.filter((t) => saved.includes(t.id)).map((t) => <Pressable key={t.id} accessibilityRole="button" accessibilityLabel={`Open saved wall ${t.title}`}
          onPress={() => router.push(`/tag/${t.id}`)} style={[ui.card, ui.row]}>
          <ArtImage uri={coverPhoto(t)?.uri} style={{ width: 65, height: 65, borderRadius: 13 }} />
          <View style={{ flex: 1, gap: 7 }}><Text style={ui.subtitle}>{t.title}</Text><Text style={ui.muted}>{t.photos.length} photographs · {t.artworks.length} artworks</Text></View>
          <Icon name="arrow-forward" color={colors.green} />
        </Pressable>)}
      </>}
    </ScrollView>
    <Modal visible={creating} animationType="slide" onRequestClose={() => setCreating(false)}>
      <SafeAreaView style={ui.screen}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 22, gap: 20, maxWidth: 650, width: '100%', alignSelf: 'center' }}>
          <Text style={ui.title}>A collection of your own.</Text>
          <Text style={ui.body}>Group pieces by city, artist, style, or whatever catches your eye.</Text>
          <CollectionForm onCreated={async (id) => { setSelected(id); setCreating(false); }} />
          <Button title="Cancel" secondary onPress={() => setCreating(false)} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  </SafeAreaView>;
}
