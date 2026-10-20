import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { Button, Field, Icon, Notice } from './UI';
import { useSocial } from '../state/Social';
import { useArchive } from '../state/Archive';
import { colors, ui } from '../theme';

export function CollectionForm({ onCreated }: { onCreated?: (id: string) => Promise<void> }) {
  const { act, ready, busy } = useSocial();
  const [name, setName] = useState(''), [error, setError] = useState(''), [working, setWorking] = useState(false);
  const create = async () => {
    setWorking(true); setError('');
    try {
      const id = Crypto.randomUUID();
      await act({ kind: 'create', collectionId: id, name });
      setName('');
      await onCreated?.(id);
    } catch (e) { setError((e as Error).message); }
    finally { setWorking(false); }
  };
  return <View style={{ gap: 12 }}>
    <Field label="Collection name" placeholder="e.g. Zagreb favourites" maxLength={60} value={name} onChangeText={setName} />
    {!!error && <Notice text={error} error />}
    <Button title="Create collection" icon="add-outline" disabled={!ready || busy || !name.trim()} busy={working} onPress={create} />
  </View>;
}

export default function PieceActions({ artworkId, tagId, title }: { artworkId: string; tagId: string; title: string }) {
  const { data, ready, busy, error: loadError, act } = useSocial();
  const { isDemo, isPersonal, session } = useArchive();
  const [open, setOpen] = useState(false), [error, setError] = useState('');
  const liked = data.liked.includes(artworkId), saved = data.pieces.some((p) => p.artworkId === artworkId);
  const count = data.counts[artworkId] || 0;
  const run = async (action: Parameters<typeof act>[0]) => {
    setError('');
    try { await act(action); } catch (e) { setError((e as Error).message); }
  };
  return <View style={{ gap: 10 }}>
    <View style={[ui.row, { flexWrap: 'wrap' }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${liked ? 'Unlike' : 'Like'} ${title}`}
        accessibilityState={{ selected: liked, disabled: !ready || busy }} aria-pressed={liked} disabled={!ready || busy}
        onPress={() => run({ kind: 'like', artworkId, enabled: !liked })}
        style={[ui.row, { minHeight: 44, paddingHorizontal: 13, borderRadius: 22, backgroundColor: liked ? '#FCEEEB' : colors.soft }]}>
        <Icon name={liked ? 'heart' : 'heart-outline'} color={liked ? colors.danger : colors.ink} />
        <Text style={ui.body}>{ready ? `${count} ${count === 1 ? 'like' : 'likes'}` : 'Loading likes…'}</Text>
      </Pressable>
      <Button title={saved ? 'Saved · Organize' : 'Save piece'} icon={saved ? 'bookmark' : 'bookmark-outline'} secondary disabled={!ready || busy}
        onPress={async () => {
          if (!saved) {
            try { await act({ kind: 'save', artworkId, tagId, enabled: true }); }
            catch (e) { setError((e as Error).message); return; }
          }
          setError(''); setOpen(true);
        }} />
    </View>
    {(isDemo || isPersonal) && <Text style={ui.muted}>Likes and collections stay on this device.</Text>}
    {!!(error || loadError) && <Notice text={error || loadError} error />}
    {!isDemo && !session && <Button title="Sign in" secondary onPress={() => router.push('/account')} />}
    <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
      <SafeAreaView style={ui.screen}>
        <View style={{ paddingHorizontal: 20, paddingTop: 12 }}><Button title="Done" secondary onPress={() => setOpen(false)} /></View>
        <View style={{ padding: 22, gap: 6 }}><Text style={ui.title}>Save to collections</Text><Text style={ui.muted}>{title}</Text></View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 22, gap: 16, maxWidth: 650, width: '100%', alignSelf: 'center' }}>
          <Text style={ui.body}>Keep this piece in as many collections as you like. Your collections are private.</Text>
          {!!error && <Notice text={error} error />}
          {!data.collections.length && <Text style={ui.muted}>Start your first collection below.</Text>}
          {data.collections.map((c) => {
            const checked = c.artworkIds.includes(artworkId);
            return <Pressable key={c.id} accessibilityRole="checkbox" accessibilityLabel={c.name}
              accessibilityState={{ checked, disabled: busy }} aria-checked={checked} disabled={busy}
              onPress={() => run({ kind: 'membership', artworkId, tagId, collectionId: c.id, enabled: !checked })}
              style={[ui.card, ui.row]}>
              <Icon name={checked ? 'checkbox' : 'square-outline'} color={colors.green} />
              <View style={{ flex: 1 }}><Text style={ui.subtitle}>{c.name}</Text><Text style={ui.muted}>{c.artworkIds.length} pieces</Text></View>
            </Pressable>;
          })}
          <CollectionForm onCreated={async (collectionId) => { await act({ kind: 'membership', collectionId, artworkId, tagId, enabled: true }); }} />
          <Button title="View all saved graffiti" secondary onPress={() => { setOpen(false); router.push('/collection'); }} />
          <Button title="Remove from saved and all collections" secondary disabled={busy} onPress={async () => {
            try { await act({ kind: 'save', artworkId, enabled: false }); setOpen(false); }
            catch (e) { setError((e as Error).message); }
          }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  </View>;
}
