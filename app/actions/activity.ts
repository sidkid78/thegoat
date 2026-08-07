'use server';

import { createClient } from '@/lib/supabase/server';

/**
 * Records that the signed-in user opened a property detail page.
 *
 * Called from a client effect rather than during the page's server render:
 * a Server Component can be re-rendered, prefetched or replayed, and treating
 * any of that as a deliberate view would inflate the signal with pages the
 * user never actually looked at.
 *
 * Everything meaningful is enforced in `record_property_view` -- it resolves
 * the user from `auth.uid()`, honours the tracking opt-out, and runs
 * SECURITY INVOKER so RLS still applies. A caller cannot record a view for
 * somebody else or against the opt-out by calling this directly.
 *
 * Failures are swallowed. Analytics must never be able to break a page.
 */
export async function recordPropertyViewAction(propertyId: number): Promise<void> {
  if (!Number.isInteger(propertyId) || propertyId <= 0) return;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.rpc('record_property_view', { p_property_id: propertyId });
  } catch {
    // Intentionally silent.
  }
}
