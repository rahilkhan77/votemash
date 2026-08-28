/**
 * Server-side Supabase client
 * Use in Server Components, API routes, and server utilities
 * Uses anon key with RLS
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { env } from '@/lib/env';

let serverClient: ReturnType<typeof createServerClient> | null = null;

export async function getSupabaseServerClient() {
  if (!serverClient) {
    const cookieStore = await cookies();

    serverClient = createServerClient(env.supabase.url, env.supabase.anonKey, {
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

  return serverClient;
}

export type Database = any; // TODO: Generate from Supabase schema
