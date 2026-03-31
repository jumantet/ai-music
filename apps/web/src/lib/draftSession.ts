import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'draft_session_id';

function randomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

/** Identifiant stable pour brouillons anonymes (header `x-session-id`). */
export async function ensureDraftSessionId(): Promise<string> {
  try {
    let id = await AsyncStorage.getItem(STORAGE_KEY);
    if (!id || id.length < 8) {
      id = randomId();
      await AsyncStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    return randomId();
  }
}
