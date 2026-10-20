import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { Asset } from 'expo-asset';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk/700Bold';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppUpdatesProvider } from '../state/AppUpdates';
import { ArchiveProvider } from '../state/Archive';
import { SocialProvider } from '../state/Social';
import { UserLocationProvider } from '../state/UserLocation';
import { installWebInputFocusStyle } from '../components/webFocus';
import LoadingScreen, { loadingArtwork } from '../components/LoadingScreen';
export default function Layout() {
  const [artworkReady, setArtworkReady] = useState(false);
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    SpaceGrotesk_700Bold,
  });
  useEffect(() => {
    if (Platform.OS === 'web') installWebInputFocusStyle();
  }, []);
  useEffect(() => {
    let active = true;
    Asset.loadAsync(loadingArtwork)
      .catch(() => {})
      .finally(() => active && setArtworkReady(true));
    return () => { active = false; };
  }, []);
  const ready = (loaded || !!error) && artworkReady;
  useEffect(() => {
    // Personal exports show the same design before the JS bundle even starts.
    // Remove that static cover only when the app can render its first screen.
    if (ready && Platform.OS === 'web') document.getElementById('graffiti-launch-screen')?.remove();
  }, [ready]);
  if (!ready)
    return (
      <>
        <StatusBar style="light" />
        <LoadingScreen fontReady={loaded} />
      </>
    );
  return (
    <SafeAreaProvider>
      <ArchiveProvider>
        <SocialProvider>
          <AppUpdatesProvider>
            <UserLocationProvider>
              <StatusBar style="dark" />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: '#F9FAF5' },
                  animation: 'slide_from_right',
                }}
              />
            </UserLocationProvider>
          </AppUpdatesProvider>
        </SocialProvider>
      </ArchiveProvider>
    </SafeAreaProvider>
  );
}
