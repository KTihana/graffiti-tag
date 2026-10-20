import AsyncStorage from '@react-native-async-storage/async-storage';
import { demoTags } from '../data/demo';
import type { Report, Revision, Tag } from '../types';
import { isPersonal } from './supabase';

export const LOCAL_KEY = isPersonal ? 'graffiti-tag-personal-v1' : 'graffiti-tag-demo-v1';
export const SAVED_KEY = isPersonal ? 'graffiti-tag-personal-saved-v1' : 'demo-saved-tags';

export const SOCIAL_KEY = isPersonal ? 'graffiti-tag-personal-social-v1' : 'graffiti-tag-demo-social-v1';

export type LocalData = { tags: Tag[]; revisions: Revision[]; reports: Report[] };

function initialLocalArchive(): LocalData {
  return {
    // The demo seed is mutable through local editing, so always return a fresh object graph.
    tags: isPersonal ? [] : JSON.parse(JSON.stringify(demoTags)),
    revisions: [],
    reports: [],
  };
}

export async function loadLocalArchive(): Promise<LocalData> {
  const saved = await AsyncStorage.getItem(LOCAL_KEY);
  return saved ? JSON.parse(saved) : initialLocalArchive();
}

export async function saveLocalArchive(data: LocalData): Promise<void> {
  await AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(data));
}
