import React, { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { colors, fonts } from '../theme';

export const loadingArtwork = [
  require('../../assets/loading/dark-map.jpg'),
  require('../../assets/loading/pin-sticker.png'),
];

export default function LoadingScreen({ fontReady = false }: { fontReady?: boolean }) {
  const { width, height } = useWindowDimensions();
  // Scale the foreground as a unit to fit short screens, tablets and rotation.
  // Only the decorative background may crop; the pin always uses contain.
  const frameWidth = Math.max(1, Math.min(width - 32, (height - 48) * 9 / 16, 500));
  const frameHeight = frameWidth * 16 / 9;
  const [progress] = useState(() => new Animated.Value(0));
  const [reduceMotion, setReduceMotion] = useState(true);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => active && setReduceMotion(value));
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const animation = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: 1400,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
        isInteraction: false,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [progress, reduceMotion]);

  return (
    <View style={s.screen} testID="app-loading-screen" accessibilityLabel="Loading Graffiti Tag" accessibilityRole="progressbar" accessibilityState={{ busy: true }}>
      <Image source={loadingArtwork[0]} style={StyleSheet.absoluteFill} resizeMode="cover" accessible={false} />
      <View style={{ width: frameWidth, height: frameHeight }}>
        <Image source={loadingArtwork[1]} resizeMode="contain" accessible={false} style={s.pin} />
        <Text
          style={[s.title, {
            fontFamily: fontReady ? fonts.display : undefined,
            fontWeight: fontReady ? undefined : '700',
            fontSize: frameWidth * 0.145,
            lineHeight: frameWidth * 0.145,
            letterSpacing: -frameWidth * 0.005,
          }]}
        >
          {'GRAFFITI\nTAG'}
        </Text>
        <View style={s.loading}>
          <Text style={[s.label, { fontSize: frameWidth * 0.024, letterSpacing: frameWidth * 0.007 }]}>LOADING</Text>
          <View style={[s.track, { height: Math.max(3, frameWidth * 0.0085), marginTop: frameWidth * 0.025 }]}>
            <Animated.View style={[s.bar, !reduceMotion && {
              transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-frameWidth * 0.23, frameWidth * 0.35] }) }],
            }]} />
          </View>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#20251F', alignItems: 'center', justifyContent: 'center' },
  pin: { position: 'absolute', top: '10%', left: '14%', width: '72%', height: '54%' },
  title: { position: 'absolute', top: '65%', width: '100%', color: colors.paper, textAlign: 'center' },
  loading: { position: 'absolute', top: '84%', left: '32.5%', width: '35%', alignItems: 'center' },
  label: { color: colors.paper },
  track: { width: '100%', backgroundColor: 'rgba(249,250,245,0.2)', borderRadius: 2, overflow: 'hidden' },
  bar: { width: '65%', height: '100%', borderRadius: 2, backgroundColor: colors.lime },
});
