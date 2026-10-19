import { StyleSheet } from 'react-native';
export const colors = {
  ink: '#20251F',
  muted: '#73786C',
  paper: '#F9FAF5',
  white: '#FFFFFF',
  line: '#E6E9DE',
  lime: '#DFFF65',
  green: '#426349',
  soft: '#EFF2E8',
  danger: '#A33932',
};
export const fonts = {
  body: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  bold: 'Inter_600SemiBold',
  display: 'SpaceGrotesk_700Bold',
};
export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  body: { fontFamily: fonts.body, color: colors.ink, fontSize: 14, lineHeight: 21 },
  muted: { fontFamily: fonts.body, color: colors.muted, fontSize: 12, lineHeight: 18 },
  title: {
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 34,
    color: colors.ink,
    letterSpacing: -1.2,
  },
  subtitle: { fontFamily: fonts.display, fontSize: 21, color: colors.ink, letterSpacing: -0.6 },
  label: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.muted,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 14,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.ink,
    minHeight: 50,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 20,
  },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: 18 },
});
