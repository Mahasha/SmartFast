/**
 * Supabase Client Wrapper
 *
 * Initializes the Supabase client with URL and anon key from environment config.
 * Configures auth persistence using AsyncStorage adapter for React Native.
 *
 * Requirements: 26
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

import { ENV } from '../utils/env';

/**
 * Supabase client instance configured for React Native with AsyncStorage-based
 * auth persistence. The client uses the anon key for public access and relies
 * on Row Level Security (RLS) policies to enforce per-user data isolation.
 */
export const supabase: SupabaseClient = createClient(ENV.supabaseUrl, ENV.supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // Not applicable in React Native
  },
});
