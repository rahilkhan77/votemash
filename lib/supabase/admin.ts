/**
 * Admin Supabase client (service role)
 * Use ONLY in server-side utilities for trusted operations
 * NEVER expose this client to the browser
 * NEVER use in API routes that accept untrusted input without validation
 */

import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

let adminClient: ReturnType<typeof createClient> | null = null;

export function getSupabaseAdmin() {
  if (!adminClient) {
    if (typeof window !== 'undefined') {
      throw new Error('Admin client cannot be instantiated in browser context');
    }

    adminClient = createClient(env.supabase.url, env.supabaseServiceKey(), {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return adminClient;
}

export type Database = any; // TODO: Generate from Supabase schema
