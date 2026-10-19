import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const archiveMode = process.env.EXPO_PUBLIC_ARCHIVE_MODE;
export const isPersonal = archiveMode === 'personal';
export const isDemo = archiveMode === 'personal' || archiveMode === 'demo' || !url || !key;
export const supabase =
  !isDemo && url && key
    ? createClient(url, key, {
        auth: {
          storage: AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      })
    : null;
if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) =>
    state === 'active' ? supabase.auth.startAutoRefresh() : supabase.auth.stopAutoRefresh(),
  );
}
