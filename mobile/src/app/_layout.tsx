import React, { useEffect } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk/700Bold';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ArchiveProvider } from '../state/Archive';
import { installWebInputFocusStyle } from '../components/webFocus';
export default function Layout() {
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    SpaceGrotesk_700Bold,
  });
  useEffect(() => {
    if (Platform.OS === 'web') installWebInputFocusStyle();
  }, []);
  if (!loaded && !error)
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#F9FAF5',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color="#426349" />
      </View>
    );
  return (
    <SafeAreaProvider>
      <ArchiveProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#F9FAF5' },
            animation: 'slide_from_right',
          }}
        />
      </ArchiveProvider>
    </SafeAreaProvider>
  );
}
