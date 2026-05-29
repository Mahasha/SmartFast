import Constants from 'expo-constants';

/**
 * Environment configuration for FastTrack.
 * Reads Supabase credentials from Expo constants (app.config / .env).
 */

interface EnvConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

const extra = Constants.expoConfig?.extra;

export const ENV: EnvConfig = {
  supabaseUrl: (extra?.supabaseUrl as string) ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey:
    (extra?.supabaseAnonKey as string) ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
};
