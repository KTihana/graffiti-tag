import React from 'react';
import { Text, View } from 'react-native';
import { ui } from '../theme';
export default function PersonalArchivePanel() {
  return (
    <View style={{ gap: 12 }}>
      <Text style={ui.body}>Your archive is saved on this device.</Text>
      <Text style={ui.muted}>
        The personal phone release is currently available as a browser-installed app, including
        backup and restore.
      </Text>
    </View>
  );
}
