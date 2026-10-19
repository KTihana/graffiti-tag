import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ImageStyle,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { colors, fonts, ui } from '../theme';
import { resolvePhotoUri } from '../services/media';
export type IconName = React.ComponentProps<typeof Ionicons>['name'];
export function Icon({
  name,
  size = 20,
  color = colors.ink,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  return <Ionicons name={name} size={size} color={color} />;
}
export function Button({
  title,
  onPress,
  icon,
  secondary,
  disabled,
  busy,
  style,
}: {
  title: string;
  onPress: () => void;
  icon?: IconName;
  secondary?: boolean;
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        {
          backgroundColor: secondary ? colors.soft : colors.ink,
          opacity: disabled || busy ? 0.5 : pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={secondary ? colors.ink : colors.lime} />
      ) : icon ? (
        <Icon name={icon} color={secondary ? colors.ink : colors.lime} />
      ) : null}
      <Text style={[s.buttonText, { color: secondary ? colors.ink : colors.white }]}>{title}</Text>
    </Pressable>
  );
}
export function IconButton({
  icon,
  label,
  onPress,
  dark = false,
  disabled = false,
  color,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  dark?: boolean;
  disabled?: boolean;
  color?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy: disabled }}
      aria-disabled={disabled}
      aria-busy={disabled}
      disabled={disabled}
      onPress={onPress}
      style={[s.iconButton, dark && { backgroundColor: colors.ink }]}
    >
      <Icon name={icon} color={color || (dark ? colors.lime : colors.ink)} />
    </Pressable>
  );
}
export function Chip({
  text,
  active,
  onPress,
  icon,
}: {
  text: string;
  active?: boolean;
  onPress: () => void;
  icon?: IconName;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={text}
      accessibilityState={{ selected: !!active }}
      onPress={onPress}
      style={[s.chip, active && { backgroundColor: colors.ink }]}
    >
      {icon && <Icon name={icon} size={15} color={active ? colors.lime : colors.muted} />}
      <Text
        style={{
          fontFamily: fonts.medium,
          fontSize: 12,
          color: active ? colors.white : colors.ink,
        }}
      >
        {text}
      </Text>
    </Pressable>
  );
}
export function Field({
  label,
  hint,
  ...props
}: TextInputProps & { label: string; hint?: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 7 }}>
      <Text style={[ui.label, { letterSpacing: 0.6 }]}>{label}</Text>
      <TextInput
        {...props}
        accessibilityLabel={label}
        placeholderTextColor="#979C91"
        onFocus={(event) => {
          setFocused(true);
          props.onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          props.onBlur?.(event);
        }}
        style={[
          ui.input,
          focused && s.inputFocused,
          props.multiline && { minHeight: 96, textAlignVertical: 'top' },
          props.style,
        ]}
      />
      {hint && <Text style={ui.muted}>{hint}</Text>}
    </View>
  );
}
export function Notice({ text, error = false }: { text: string; error?: boolean }) {
  return (
    <View
      accessibilityRole="alert"
      style={{
        padding: 13,
        borderRadius: 12,
        backgroundColor: error ? '#FCEEEB' : colors.soft,
        flexDirection: 'row',
        gap: 9,
      }}
    >
      <Icon
        name={error ? 'alert-circle-outline' : 'information-circle-outline'}
        color={error ? colors.danger : colors.green}
        size={18}
      />
      <Text style={[ui.muted, { flex: 1, color: error ? colors.danger : colors.green }]}>
        {text}
      </Text>
    </View>
  );
}
export function Header({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={s.header}>
      <IconButton
        icon="arrow-back"
        label="Go back"
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      />
      <View style={{ flex: 1 }}>
        <Text style={[ui.subtitle, { fontSize: 18 }]}>{title}</Text>
        {subtitle && <Text style={ui.muted}>{subtitle}</Text>}
      </View>
      {right}
    </View>
  );
}
const demoSources = [
  require('../../assets/demo/wall-1.jpg'),
  require('../../assets/demo/wall-2.jpg'),
  require('../../assets/demo/wall-3.jpg'),
  require('../../assets/demo/wall-4.jpg'),
];
export function ArtImage({
  uri,
  style,
  contain = false,
}: {
  uri?: string;
  style?: StyleProp<ImageStyle>;
  contain?: boolean;
}) {
  const [resolved, setResolved] = useState(uri?.startsWith('idb:') ? undefined : uri),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    if (uri)
      resolvePhotoUri(uri)
        .then((value) => {
          if (alive) {
            setFailed(false);
            setResolved(value);
          }
        })
        .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [uri]);
  const file = uri?.match(/Graffiti_in_Zagreb_(02|05|06|07)/)?.[1];
  const source = file ? demoSources[['02', '05', '06', '07'].indexOf(file)] : { uri: resolved };
  if (!uri || failed || (!resolved && !file))
    return (
      <View
        style={[
          style as StyleProp<ViewStyle>,
          { backgroundColor: colors.soft, justifyContent: 'center', alignItems: 'center' },
        ]}
      >
        <Icon name="image-outline" color={colors.muted} size={30} />
      </View>
    );
  return (
    <Image
      accessibilityLabel="Archived graffiti photograph"
      source={source}
      style={style}
      resizeMode={contain ? 'contain' : 'cover'}
      onError={() => setFailed(true)}
    />
  );
}
const s = StyleSheet.create({
  button: {
    flexDirection: 'row',
    gap: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    padding: 16,
    minHeight: 52,
  },
  buttonText: { fontFamily: fonts.bold, fontSize: 14, flexShrink: 1, textAlign: 'center' },
  iconButton: {
    flexShrink: 0,
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 11,
    backgroundColor: colors.white,
  },
  inputFocused: { borderWidth: 2, borderColor: colors.green },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderBottomWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
  },
});
