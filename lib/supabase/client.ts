/**
 * Browser/Client Supabase client
 * Use only in client components and browser contexts
 * Limited to public/anon access
 */

import { createBrowserClient } from '@supabase/ssr';
import { env } from '@/lib/env';

let client: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseClient() {
  if (!client) {
    client = createBrowserClient(env.supabase.url, env.supabase.anonKey);
  }
  return client;
}

export type Database = any; // TODO: Generate from Supabase schema
