import { createClient } from '@/lib/supabase/server';
import { createClient as createBaseClient } from '@supabase/supabase-js';
import { generateEmbedding } from './client';

async function getSupabaseClient() {
  try {
    return await createClient();
  } catch {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    return createBaseClient(url, key);
  }
}

// ============================================================================
// TOOL DECLARATIONS FOR GEMINI FUNCTION CALLING
// ============================================================================

export const searchPropertiesToolDeclaration = {
  type: 'function',
  name: 'searchProperties',
  description:
    'Search for active real estate properties using natural language query, location, price filters, and room criteria via vector similarity.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Natural language search query describing desired home attributes or lifestyle.',
      },
      city: {
        type: 'string',
        description: 'Target city name (e.g. Austin, Round Rock).',
      },
      minPrice: {
        type: 'number',
        description: 'Minimum price filter in USD.',
      },
      maxPrice: {
        type: 'number',
        description: 'Maximum price filter in USD.',
      },
      minBedrooms: {
        type: 'number',
        description: 'Minimum number of bedrooms.',
      },
      minBathrooms: {
        type: 'number',
        description: 'Minimum number of bathrooms.',
      },
    },
    required: ['query'],
  },
};

export const schedulePropertyViewingToolDeclaration = {
  type: 'function',
  name: 'schedulePropertyViewing',
  description: 'Book a property tour / viewing for a buyer.',
  parameters: {
    type: 'object',
    properties: {
      propertyId: {
        type: 'number',
        description: 'Numeric property ID in the database.',
      },
      preferredDateTime: {
        type: 'string',
        description: 'ISO 8601 formatted datetime string requested by buyer.',
      },
      notes: {
        type: 'string',
        description: 'Special requests or preferences for the tour.',
      },
    },
    required: ['propertyId', 'preferredDateTime'],
  },
};

export const ALL_AGENT_TOOLS = [
  searchPropertiesToolDeclaration,
  schedulePropertyViewingToolDeclaration,
];

// ============================================================================
// TOOL EXECUTOR HANDLERS
// ============================================================================

export async function executeSearchProperties(args: {
  query: string;
  city?: string;
  minPrice?: number;
  maxPrice?: number;
  minBedrooms?: number;
  minBathrooms?: number;
}) {
  const supabase = await getSupabaseClient();

  // 1. Generate 768-dimension embedding via text-embedding-004
  const queryVector = await generateEmbedding(args.query);

  // 2. Call Supabase RPC match_properties (pgvector HNSW)
  const { data, error } = await supabase.rpc('match_properties', {
    query_embedding: queryVector,
    match_threshold: 0.2,
    match_count: 6,
    filter_city: args.city || null,
    filter_min_price: args.minPrice || null,
    filter_max_price: args.maxPrice || null,
    filter_min_bedrooms: args.minBedrooms || null,
    filter_min_bathrooms: args.minBathrooms || null,
  });

  if (error) {
    console.error('Supabase RPC vector search error:', error);
    return { success: false, error: error.message, listings: [] };
  }

  const listings = (data || []).map((p: any) => ({
    ...p,
    id: p.id ?? p.property_id,
  }));

  return {
    success: true,
    resultCount: listings.length,
    listings,
  };
}

export async function executeScheduleViewing(
  userId: string,
  args: { propertyId: number; preferredDateTime: string; notes?: string }
) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('viewings')
    .insert({
      property_id: args.propertyId,
      user_id: userId,
      scheduled_at: args.preferredDateTime,
      status: 'scheduled',
      notes: args.notes || 'Scheduled via AI Assistant',
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return {
    success: true,
    confirmationId: data.id,
    scheduledAt: data.scheduled_at,
    message: 'Viewing request successfully submitted to the listing agent.',
  };
}
