import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';

type Props = { count: number; selected: boolean };

export default function GraffitiPinMarker({ count, selected }: Props) {
  const badge = selected ? colors.lime : colors.ink;
  const foreground = selected ? colors.ink : colors.lime;

  if (count > 1)
    return (
      <View style={[styles.badge, { backgroundColor: badge }]}>
        <Text style={[styles.count, { color: foreground }]}>{count}</Text>
      </View>
    );

  return (
    <Image
      source={
        selected
          ? require('../../assets/markers/pin-selected.png')
          : require('../../assets/markers/pin.png')
      }
      style={styles.marker}
      resizeMode="contain"
    />
  );
}

const styles = StyleSheet.create({
  badge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderColor: colors.white,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#20251f',
    shadowOpacity: 0.2,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  count: { fontFamily: fonts.bold, fontSize: 14 },
  marker: { width: 44, height: 50 },
});
