import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { getCurrentLocation, watchLocation } from '../services/location';
import type { UserLocation } from '../types';

function locationMessage(error: unknown): string {
  const detail = error as { code?: string | number; message?: string } | null;
  const message = typeof error === 'string' ? error : detail?.message || '';
  if (detail?.code === 1 || detail?.code === 'OS-PLUG-GLOC-0003' || /permission|denied/i.test(message))
    return 'Location permission is off. You can still explore and place tags manually.';
  if (detail?.code === 3 || /timed?\s*out|timeout/i.test(message))
    return 'Finding your location took too long. Try again outdoors, or place the pin manually.';
  return 'Could not find your location. Check that device location is on and try again. You can still place tags manually.';
}

type LocationState = {
  position: UserLocation | null;
  locating: boolean;
  error: string;
  dismissError: () => void;
  locate: () => Promise<UserLocation | null>;
};
const Context = createContext<LocationState | null>(null);

export function UserLocationProvider({ children }: { children: React.ReactNode }) {
  const [position, setPosition] = useState<UserLocation | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef<Promise<UserLocation | null> | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const subscription = AppState.addEventListener('change', (state) => {
      setForeground(state === 'active');
      if (state !== 'active') setPosition(null);
    });
    return () => {
      mounted.current = false;
      subscription.remove();
    };
  }, []);

  // Permission is requested only by locate(). Resume updates only after opting in.
  useEffect(() => {
    if (!enabled || !foreground) return;
    let active = true;
    let stop: (() => void) | undefined;
    const fail = (reason: unknown) => {
      if (!active) return;
      setPosition(null);
      setEnabled(false);
      setError(locationMessage(reason));
    };
    watchLocation((next) => {
      if (active) {
        setPosition(next);
        setError('');
      }
    }, fail).then((remove) => {
      if (active) stop = remove;
      else remove();
    }).catch(fail);
    return () => {
      active = false;
      stop?.();
    };
  }, [enabled, foreground]);

  const locate = useCallback((): Promise<UserLocation | null> => {
    if (pending.current) return pending.current;
    setLocating(true);
    setError('');
    const request = (async () => {
      try {
        const next = await getCurrentLocation();
        if (!mounted.current || AppState.currentState !== 'active') return null;
        setPosition(next);
        setEnabled(true);
        return next;
      } catch (reason) {
        if (mounted.current) {
          setPosition(null);
          setEnabled(false);
          setError(locationMessage(reason));
        }
        return null;
      } finally {
        pending.current = null;
        if (mounted.current) setLocating(false);
      }
    })();
    pending.current = request;
    return request;
  }, []);

  return (
    <Context.Provider value={{ position, locating, error, dismissError: () => setError(''), locate }}>
      {children}
    </Context.Provider>
  );
}

export function useUserLocation() {
  const value = useContext(Context);
  if (!value) throw new Error('UserLocationProvider is missing');
  return value;
}
