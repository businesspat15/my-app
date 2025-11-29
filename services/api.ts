// services/api.ts
import { UserState } from '../types';
import { supabase } from './supabaseClient';

/**
 * Helper: safe localStorage set/get (guards for SSR and errors)
 */
const safeSetLocal = (key: string, value: string) => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
  } catch (e) {
    // ignore localStorage errors
    // console.warn('localStorage set failed', e);
  }
};

const safeGetLocal = (key: string): string | null => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
  } catch (e) {
    // console.warn('localStorage get failed', e);
  }
  return null;
};

const mapDbToUser = (data: any): UserState => {
  return {
    id: String(data.id),
    username: data.username ?? 'CEO',
    coins: Number(data.coins ?? 0),
    businesses: data.businesses ?? {},
    level: Number(data.level ?? 1),
    lastMine: Number(data.last_mine ?? 0),
    referredBy: data.referred_by ?? null,
    referralsCount: Number(data.referrals_count ?? 0),
    subscribed: Boolean(data.subscribed ?? false),
    languageCode: data.language_code ?? 'en',
  };
};

export const api = {
  /**
   * Fetches user data from Supabase.
   * Falls back to localStorage if offline or credentials missing.
   */
  getUser: async (telegramId: string): Promise<UserState | null> => {
    // 1) Try Supabase if initialized
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', telegramId)
          .single();

        // If supabase returned an error other than "row not found", log it
        if (error && (error as any).code !== 'PGRST116') {
          console.warn('Supabase getUser error:', error);
        }

        if (data) {
          const mapped = mapDbToUser(data);
          safeSetLocal(`user_${telegramId}`, JSON.stringify(mapped));
          return mapped;
        }
      } catch (err) {
        console.warn('Supabase fetch failed / offline, falling back to local cache:', err);
      }
    } else {
      // Supabase client not configured
      // console.log('Supabase not configured, checking local cache');
    }

    // 2) Fallback to localStorage
    const cached = safeGetLocal(`user_${telegramId}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        return parsed as UserState;
      } catch (e) {
        console.error('Error parsing cached user:', e);
      }
    }

    return null;
  },

  /**
   * Saves or updates the user data to Supabase.
   * Always saves to localStorage to ensure data safety / optimistic UI.
   * Returns the saved DB row when available.
   */
  saveUser: async (user: UserState): Promise<UserState | null> => {
    // 1) Optimistic local save
    try {
      safeSetLocal(`user_${user.id}`, JSON.stringify(user));
    } catch (e) {
      console.error('Local storage save failed:', e);
    }

    // 2) Sync with Supabase if available
    if (supabase) {
      try {
        const dbPayload = {
          id: user.id,
          username: user.username,
          coins: user.coins,
          businesses: user.businesses,
          level: user.level,
          last_mine: user.lastMine,
          referred_by: user.referredBy,
          referrals_count: user.referralsCount,
          subscribed: user.subscribed,
          language_code: user.languageCode
        };

        // Use upsert to create or update
        // request returning row to confirm saved state
        const { data, error } = await supabase
          .from('users')
          .upsert(dbPayload, { onConflict: 'id' })
          .select()
          .single();

        if (error) {
          console.warn('Supabase upsert error (saved locally):', error);
          return null;
        }

        if (data) {
          const mapped = mapDbToUser(data);
          // refresh local cache with authoritative row
          safeSetLocal(`user_${user.id}`, JSON.stringify(mapped));
          return mapped;
        }
      } catch (error) {
        console.warn('Supabase sync failed (saved locally):', error);
      }
    }

    // If we couldn't sync, return optimistic local copy
    return user;
  }
};
