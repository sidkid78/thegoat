import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser-side Supabase client.
 *
 * The rest of the app deliberately has no browser client -- client components
 * reach the database through Server Actions and route handlers, so the
 * cookie-backed server client in `./server.ts` stays the single access point.
 * The one thing that pattern cannot do is hold an open websocket, which the
 * deal message thread needs, so this exists purely for Realtime subscriptions.
 *
 * It reads the anon key and is subject to RLS exactly like the server client:
 * `offer_messages` only broadcasts rows a subscriber's SELECT policy would
 * already have returned. Writes still go through Server Actions -- don't reach
 * for this to insert or update.
 */
export function createBrowserSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
