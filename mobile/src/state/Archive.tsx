import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { SAVED_KEY } from '../services/localArchive';
import { isDemo, isPersonal, supabase } from '../services/supabase';
const Context = createContext({
  isDemo,
  isPersonal,
  session: null as Session | null,
  alias: isPersonal ? 'Me' : 'Local contributor',
  moderator: false,
  saved: [] as string[],
  toggleSaved: async (_id: string) => {},
  version: 0,
  refresh: () => {},
});
export function ArchiveProvider({ children }: React.PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null),
    [saved, setSaved] = useState<string[]>([]),
    [version, setVersion] = useState(0),
    [moderatorId, setModeratorId] = useState<string | null>(null);
  useEffect(() => {
    AsyncStorage.getItem(isDemo ? SAVED_KEY : 'live-saved-tags')
      .then((v) => v && setSaved(JSON.parse(v)))
      .catch(() => {});
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    const channel = supabase
      .channel('archive')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tags' }, () =>
        setVersion((v) => v + 1),
      )
      .subscribe();
    return () => {
      data.subscription.unsubscribe();
      supabase!.removeChannel(channel);
    };
  }, []);
  useEffect(() => {
    let active = true;
    if (!session || !supabase) return;
    supabase
      .from('moderators')
      .select('user_id')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setModeratorId(data?.user_id ?? null);
      });
    return () => {
      active = false;
    };
  }, [session]);
  useEffect(() => {
    if (!version) return;
    AsyncStorage.getItem(isDemo ? SAVED_KEY : 'live-saved-tags')
      .then((value) => setSaved(value ? JSON.parse(value) : []))
      .catch(() => {});
  }, [version]);
  const toggleSaved = async (id: string) => {
    const next = saved.includes(id) ? saved.filter((x) => x !== id) : [...saved, id];
    await AsyncStorage.setItem(isDemo ? SAVED_KEY : 'live-saved-tags', JSON.stringify(next));
    setSaved(next);
  };
  return (
    <Context.Provider
      value={{
        isDemo,
        isPersonal,
        session,
        alias:
          session?.user.user_metadata?.alias ||
          (isPersonal ? 'Me' : isDemo ? 'Local contributor' : 'Community contributor'),
        moderator: !!session && moderatorId === session.user.id,
        saved,
        toggleSaved,
        version,
        refresh: () => setVersion((v) => v + 1),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useArchive = () => useContext(Context);
