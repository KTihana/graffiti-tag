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
          Graffiti is how the city speaks and is a part of our culture. It carries local styles,
          rivalries, and stories, with each generation of writers adding something of their own.
          That culture takes years to build, but the work can disappear overnight. Pieces get
          painted over and walls come down. Graffiti Tag is a way to keep a record of what was there.
        </Text>
        <Text style={ui.subtitle}>Different cities. Different styles.</Text>
        <Text style={ui.body}>
          Seeing graffiti from around the world means getting to know the scenes behind it. The
          letterforms, the spots, the ways writers make a style their own. It’s a shared culture,
          but every place has its own history.
        </Text>
        <Text style={ui.subtitle}>Help keep it on record.</Text>
        <Text style={ui.body}>
          A fresh piece or a tag from twenty years ago both belong in that history. Share your
          photos, credit the writers, and add what you know. An old flick might be the only record
          of a piece someone still remembers.
        </Text>
        <Notice text="Dates describe photographs, not a guarantee that an artwork is still present. A location marks an artwork; it does not imply public access." />
      </ScrollView>
    </SafeAreaView>
  );
}
