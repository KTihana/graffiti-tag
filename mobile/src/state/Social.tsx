import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { changeSocial, emptySocial, type SocialAction, type SocialData } from '../services/socialModel';
import { isDemo, supabase } from '../services/supabase';
import { SOCIAL_KEY } from '../services/localArchive';
import { useArchive } from './Archive';

const Context = createContext({ data: emptySocial(), ready: false, busy: false, error: '', act: async (_action: SocialAction) => {} });
export function SocialProvider({ children }: React.PropsWithChildren) {
  const { session } = useArchive();
  return <SocialState key={session?.user.id || 'local'}>{children}</SocialState>;
}
function SocialState({ children }: React.PropsWithChildren) {
  const { session, version } = useArchive();
  const [data, setData] = useState<SocialData>(emptySocial), [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false), [error, setError] = useState('');
  const current = useRef(data), locked = useRef(false), generation = useRef(0), mutations = useRef(0);
  const userId = session?.user.id;
  useEffect(() => {
    generation.current++;
    let active = true;
    const load = async () => {
      if (isDemo) {
        const stored = await AsyncStorage.getItem(SOCIAL_KEY);
        return stored ? JSON.parse(stored) as SocialData : emptySocial();
      }
      const result = await supabase!.rpc('read_social');
      if (result.error) throw result.error;
      return result.data as SocialData;
    };
    const refresh = async () => {
      if (locked.current) return;
      const epoch = mutations.current;
      try {
        const next = await load();
        if (active && epoch === mutations.current) { current.current = next; setData(next); setReady(true); setError(''); }
      } catch (e) { if (active) setError((e as Error).message); }
    };
    void refresh();
    // Counts also update when another community member likes a piece.
    const timer = !isDemo ? setInterval(refresh, 30000) : undefined;
    return () => { active = false; if (timer) clearInterval(timer); };
  }, [userId, version]);
  const act = async (action: SocialAction) => {
    if (!isDemo && !userId) throw new Error('Sign in from My account to like pieces and keep private collections.');
    if (!ready) throw new Error(error || 'Your collection is still loading. Try again in a moment.');
    if (locked.current) throw new Error('Please wait for your previous change to finish.');
    locked.current = true;
    mutations.current++;
    setBusy(true);
    const gen = generation.current;
    try {
      let next: SocialData;
      if (isDemo) {
        next = changeSocial(current.current, action);
        await AsyncStorage.setItem(SOCIAL_KEY, JSON.stringify(next));
      } else {
        const result = await supabase!.rpc('change_social', { action });
        if (result.error) throw result.error;
        next = result.data as SocialData;
      }
      if (gen === generation.current) { current.current = next; setData(next); }
    } finally { locked.current = false; setBusy(false); }
  };
  return <Context.Provider value={{ data, ready, busy, error, act }}>{children}</Context.Provider>;
}
export const useSocial = () => useContext(Context);
