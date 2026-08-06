'use server';

import { createClient } from '@/lib/supabase/server';
import { generateEmbedding } from '@/lib/ai/client';
import { generateNeighborhoodVibe, type NeighborhoodVibe } from '@/lib/ai/neighborhood';
import { revalidatePath } from 'next/cache';
import { composePreferenceText, type BuyerPreferences } from '@/lib/buyer-preferences';

/**
 * Persists the buyer's priorities onto their profile and re-scores the
 * shortlist against them. Preferences live in `profiles.metadata` -- a jsonb
 * column that already exists -- rather than a new table, since it's one small
 * object per user with no history to keep.
 */
export async function saveBuyerPreferencesAction(prefs: BuyerPreferences) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false as const, error: 'Authentication required' };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('metadata')
    .eq('id', user.id)
    .single();

  const { error } = await supabase
    .from('profiles')
    .update({
      metadata: { ...(profile?.metadata ?? {}), buyerPreferences: prefs },
    })
    .eq('id', user.id);

  if (error) {
    return { success: false as const, error: error.message };
  }

  revalidatePath('/evaluate');
  // Stated priorities are the other signal the dashboard recommendations use.
  revalidatePath('/dashboard');
  return { success: true as const };
}

/**
 * Cosine similarity of every saved property against the buyer's stated
 * preferences, as a map of property id -> 0..1 score. Returns an empty map when
 * no preferences are set -- there is no meaningful match score without
 * something to match against, and a made-up number is worse than none.
 */
export async function scoreShortlistAction(): Promise<Record<number, number>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return {};

  const { data: profile } = await supabase
    .from('profiles')
    .select('metadata')
    .eq('id', user.id)
    .single();

  const prefs = profile?.metadata?.buyerPreferences as BuyerPreferences | undefined;
  if (!prefs) return {};

  const text = composePreferenceText(prefs);
  if (!text) return {};

  const embedding = await generateEmbedding(text);
  const { data, error } = await supabase.rpc('match_favorites', { query_embedding: embedding });

  if (error || !data) return {};

  const scores: Record<number, number> = {};
  for (const row of data) {
    scores[row.property_id] = row.similarity;
  }
  return scores;
}

/**
 * On-demand rather than run for every card on page load -- this is a paid,
 * Maps-grounded call per property, and a shortlist can hold a dozen listings.
 */
export async function neighborhoodVibeAction(
  propertyId: number
): Promise<{ success: true; vibe: NeighborhoodVibe } | { success: false; error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Authentication required' };

  const { data: property, error } = await supabase
    .from('properties')
    .select('address, city, state, zip_code, latitude, longitude')
    .eq('id', propertyId)
    .single();

  if (error || !property) {
    return { success: false, error: error?.message || 'Property not found' };
  }

  try {
    const vibe = await generateNeighborhoodVibe({
      address: property.address,
      city: property.city,
      state: property.state,
      zipCode: property.zip_code,
      latitude: property.latitude,
      longitude: property.longitude,
    });
    return { success: true, vibe };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
