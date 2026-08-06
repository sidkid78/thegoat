'use server';

import { createClient } from '@/lib/supabase/server';
import { generateEmbedding } from '@/lib/ai/client';
import { composePreferenceText, type BuyerPreferences } from '@/lib/buyer-preferences';

export interface RecommendedProperty {
  id: number;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  squareFeet: number | null;
  photos: string[];
  similarity: number;
}

/**
 * Which real signals produced the ranking. Surfaced so the UI can say what a
 * recommendation is actually based on instead of presenting an unexplained
 * shelf of listings.
 */
export type RecommendationBasis = 'both' | 'preferences' | 'favorites' | 'none';

export interface RecommendationResult {
  properties: RecommendedProperty[];
  basis: RecommendationBasis;
}

const EMPTY: RecommendationResult = { properties: [], basis: 'none' };

/**
 * Personalized property recommendations -- the "AI-driven property
 * recommendations" the MVP requirements list as a Must Have.
 *
 * Taste is inferred from two things the buyer has genuinely done: the
 * priorities they stated on the Evaluation Hub, and the listings they saved.
 * `match_recommendations` blends whichever exist. Deliberately *not* inferred
 * from browsing behaviour -- there is no such tracking in this app, and the
 * requirements put behaviour analytics in Could Have, not Must Have.
 *
 * With neither signal, this returns nothing rather than falling back to
 * "newest" or "most expensive" dressed up as personalization.
 */
export async function getRecommendationsAction(limit = 6): Promise<RecommendationResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return EMPTY;

  const [{ data: profile }, { count: favoriteCount }] = await Promise.all([
    supabase.from('profiles').select('metadata').eq('id', user.id).single(),
    supabase
      .from('favorites')
      .select('property_id', { count: 'exact', head: true })
      .eq('user_id', user.id),
  ]);

  const prefs = profile?.metadata?.buyerPreferences as BuyerPreferences | undefined;
  const prefText = prefs ? composePreferenceText(prefs) : '';

  const hasPrefs = Boolean(prefText);
  const hasFavorites = (favoriteCount ?? 0) > 0;
  if (!hasPrefs && !hasFavorites) return EMPTY;

  const basis: RecommendationBasis =
    hasPrefs && hasFavorites ? 'both' : hasPrefs ? 'preferences' : 'favorites';

  // Wrapped so a missing Gemini key or an embedding timeout degrades to an
  // empty shelf rather than throwing out of the dashboard render.
  let data: unknown[] | null = null;
  try {
    // Only pay for an embedding when there is stated-preference text to embed;
    // a favorites-only ranking is computed entirely in Postgres.
    const embedding = hasPrefs ? await generateEmbedding(prefText) : null;

    const res = await supabase.rpc('match_recommendations', {
      query_embedding: embedding,
      match_count: limit,
    });
    if (res.error) return EMPTY;
    data = res.data;
  } catch {
    return EMPTY;
  }

  if (!data) return EMPTY;

  return {
    basis,
    // The RPC returns `property_id`, not `id` -- every consumer of a raw RPC
    // row in this codebase has to do this mapping.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    properties: (data as any[]).map((row) => ({
      id: row.property_id,
      address: row.address,
      city: row.city,
      state: row.state,
      zipCode: row.zip_code,
      price: Number(row.price),
      bedrooms: row.bedrooms,
      bathrooms: Number(row.bathrooms),
      squareFeet: row.square_feet,
      photos: Array.isArray(row.photos) ? row.photos : [],
      similarity: Number(row.similarity),
    })),
  };
}
