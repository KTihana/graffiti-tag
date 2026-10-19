import React from 'react';
import { Image, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header, Notice } from '../components/UI';
import { useArchive } from '../state/Archive';
import { colors, ui } from '../theme';
export default function About() {
  const { isPersonal } = useArchive();
  return (
    <SafeAreaView style={ui.screen}>
      <Header
        title="The streets remember"
        subtitle={
          isPersonal ? 'Your personal graffiti archive' : 'An open, living graffiti archive'
        }
      />
      <ScrollView
        contentContainerStyle={{
          padding: 24,
          gap: 22,
          maxWidth: 650,
          width: '100%',
          alignSelf: 'center',
        }}
      >
        <View style={{ backgroundColor: colors.lime, borderRadius: 25, padding: 28, gap: 20 }}>
          <Image
            source={require('../../assets/brand-pin.png')}
            style={{ width: 52, height: 62 }}
            resizeMode="contain"
            accessibilityLabel="Graffiti Tag logo"
          />
          <Text style={[ui.title, { fontSize: 38, lineHeight: 42 }]}>
            Here today.{'\n'}Remembered{'\n'}tomorrow.
          </Text>
        </View>
        {isPersonal && (
          <Notice text="This version is your private archive. A shared community archive is planned for later. Your personal records will not be published automatically." />
        )}
        <Text style={ui.body}>
          Graffiti is a big part of culture. Walls change, buildings disappear, and a piece can be
          gone overnight. Graffiti Tag gives those stories somewhere to stay.
        </Text>
        <Text style={ui.subtitle}>One wall. Many lives.</Text>
        <Text style={ui.body}>
          A tag marks a wall. Artworks represent its different layers. Photographs document each
          artwork over time, even if the photo is old or the piece is no longer there.
        </Text>
        <Text style={ui.subtitle}>Built by the people who notice.</Text>
        <Text style={ui.body}>
          Credit artists by their chosen alias. Credit photographers separately. Use approximate or
          unknown dates when needed. Add context, correct mistakes, and help preserve a useful
          history.
        </Text>
        <Notice text="Dates describe photographs, not a guarantee that an artwork is still present. A location marks an artwork; it does not imply public access." />
      </ScrollView>
    </SafeAreaView>
  );
}
