import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Graffiti Tag',
  slug: 'graffiti-tag',
  scheme: 'graffititag',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  icon: './assets/icon.png',
  android: {
    package: 'app.graffititag.archive',
    adaptiveIcon: {
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundColor: '#DFFF65',
    },
  },
  ios: { bundleIdentifier: 'app.graffititag.archive', supportsTablet: true },
  web: { bundler: 'metro', output: 'single', favicon: './assets/icon.png' },
  extra: { googleMapsConfigured: !!process.env.GOOGLE_MAPS_ANDROID_API_KEY },
  plugins: [
    'expo-router',
    'expo-font',
    'expo-asset',
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Find nearby graffiti and help place your tag. Your live location is never published.',
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'Choose photographs to contribute to the graffiti archive.',
        cameraPermission: 'Photograph graffiti for the archive.',
        microphonePermission: false,
      },
    ],
    [
      'react-native-maps',
      {
        androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY || '',
        iosGoogleMapsApiKey: process.env.GOOGLE_MAPS_IOS_API_KEY || '',
      },
    ],
  ],
};
export default config;
