import React from 'react';
import { Text, View } from 'react-native';
import type { UserLocation } from '../types';
import { ui } from '../theme';

export default function UserLocationStatus({ position }: { position: UserLocation | null }) {
  if (!position) return null;
  const accuracy = position.accuracy;
  return (
    <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#fff', borderRadius: 12, padding: 10 }}>
      <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: '#4285F4' }} />
      <Text style={[ui.muted, { fontSize: 12 }]}>
        You are here{accuracy !== null && Number.isFinite(accuracy) ? ` · Accuracy ~${Math.max(1, Math.round(accuracy))} m` : ''}
      </Text>
    </View>
  );
}
