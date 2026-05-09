import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.trim().replace(/\/+$/, '');
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

function getProjectRefFromUrl(url) {
  try {
    return new URL(url).hostname.split('.')[0] || '';
  } catch {
    return '';
  }
}

function getProjectRefFromAnonKey(anonKey) {
  try {
    const payload = anonKey.split('.')[1];
    if (!payload) {
      return '';
    }

    const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/');
    const paddedPayload = normalizedPayload.padEnd(
      normalizedPayload.length + ((4 - (normalizedPayload.length % 4)) % 4),
      '=',
    );
    const decodedPayload = JSON.parse(globalThis.atob(paddedPayload));
    return decodedPayload.ref || '';
  } catch {
    return '';
  }
}

export function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export function getSupabaseConfig() {
  const anonKey = SUPABASE_ANON_KEY || '';
  const urlProjectRef = getProjectRefFromUrl(SUPABASE_URL || '');
  const anonKeyProjectRef = getProjectRefFromAnonKey(anonKey);

  return {
    url: SUPABASE_URL || '',
    finalUrl: SUPABASE_URL || '',
    urlProjectRef,
    anonKeyProjectRef,
    projectRefMatches:
      Boolean(urlProjectRef && anonKeyProjectRef) && urlProjectRef === anonKeyProjectRef,
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
