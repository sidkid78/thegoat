'use server';

import { generateEmbedding } from '@/lib/ai/client';
import { createClient } from '@/lib/supabase/server';

export interface SearchFilters {
  query: string;
  city?: string;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  bathrooms?: number;
}

/**
 * Executes a semantic vector search using Google text-embedding-004 and Supabase pgvector HNSW RPC
 */
export async function performVectorSearchAction(filters: SearchFilters) {
  try {
    const supabase = await createClient();

    // Generate 768-dim vector embedding using Google GenAI SDK
    const queryEmbedding = await generateEmbedding(filters.query);

    // Invoke match_properties PostgreSQL function via RPC
    const { data: matchedProperties, error } = await supabase.rpc('match_properties', {
      query_embedding: queryEmbedding,
      match_threshold: 0.15,
      match_count: 12,
      filter_city: filters.city || null,
      filter_min_price: filters.minPrice || null,
      filter_max_price: filters.maxPrice || null,
      filter_min_bedrooms: filters.bedrooms || null,
      filter_min_bathrooms: filters.bathrooms || null,
    });

    if (error) {
      console.error('Vector Search RPC Error:', error);
      return { success: false, error: error.message, results: [] };
    }

    const formattedResults = (matchedProperties || []).map((p: any) => ({
      ...p,
      id: p.id ?? p.property_id,
    }));

    return {
      success: true,
      results: formattedResults,
    };
  } catch (error: any) {
    console.error('Vector Search Action Error:', error);
    return { success: false, error: error.message, results: [] };
  }
}