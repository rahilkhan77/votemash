/**
 * Server-side Supabase client
 * Use in Server Components, API routes, and server utilities
 * Uses anon key with RLS
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { env } from '@/lib/env';

export async function getSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(env.supabase.url, env.supabase.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Handle error in server context
        }
      },
    },
  });
}

export type Database = any; // TODO: Generate from Supabase schema
