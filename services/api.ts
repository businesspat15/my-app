import { UserState } from '../types';
import { supabase } from './supabaseClient';

export const api = {
  /**
   * Fetches user data from Supabase.
   * Falls back to localStorage if offline or credentials missing.
   */
  getUser: async (telegramId: string): Promise<UserState | null> => {
    // Check if Supabase is initialized
    if (supabase) {
      try {
        // Fetch from Supabase
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', telegramId)
          .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 is "Row not found"
          throw error;
        }

        if (data) {
          // Map DB snake_case to Frontend camelCase
          const mappedUser: UserState = {
            id: data.id,
            username: data.username,
            coins: data.coins,
            businesses: data.businesses || {},
            level: data.level,
            lastMine: data.last_mine,
            referredBy: data.referred_by,
            referralsCount: data.referrals_count,
            subscribed: data.subscribed,
            languageCode: data.language_code
          };

          // Update local cache
          localStorage.setItem(`user_${telegramId}`, JSON.stringify(mappedUser));
          return mappedUser;
        }
      } catch (error) {
        console.warn('Supabase fetch failed/offline, checking local cache:', error);
      }
    } else {
      console.log('Supabase not configured, using local cache.');
    }

    // Fallback: Try to load from local storage
    const cached = localStorage.getItem(`user_${telegramId}`);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        console.error('Error parsing cached user:', e);
      }
    }
    
    return null;
  },

  /**
   * Saves or updates the user data to Supabase.
   * Always saves to localStorage to ensure data safety.
   */
  saveUser: async (user: UserState): Promise<void> => {
    // 1. Always save to local storage immediately (Optimistic Save)
    try {
      localStorage.setItem(`user_${user.id}`, JSON.stringify(user));
    } catch (e) {
      console.error('Local storage save failed:', e);
    }

    // 2. Sync with Supabase if available
    if (supabase) {
      try {
        // Map Frontend camelCase to DB snake_case
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

        const { error } = await supabase
          .from('users')
          .upsert(dbPayload, { onConflict: 'id' });

        if (error) {
          throw error;
        }
      } catch (error) {
        console.warn('Supabase sync failed (saved locally):', error);
      }
    }
  }
};
