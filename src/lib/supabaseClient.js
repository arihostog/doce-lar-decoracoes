import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.trim().replace(/\/+$/, '');
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export function getSupabaseConfig() {
  const anonKey = SUPABASE_ANON_KEY || '';

  return {
    url: SUPABASE_URL || '',
    finalUrl: SUPABASE_URL || '',
    anonKey,
    anonKeyLength: anonKey.length,
    anonKeyPreview: anonKey ? `${anonKey.slice(0, 8)}...${anonKey.slice(-6)}` : '',
    anonKeyStart: anonKey.slice(0, 8),
    anonKeyEnd: anonKey.slice(-6),
    isConfigured: isSupabaseConfigured(),
  };
}

export const supabase = isSupabaseConfigured()
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;
