import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

// Load .env.local variables
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8');
  for (const line of envConfig.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const equalsIndex = trimmed.indexOf('=');
      if (equalsIndex !== -1) {
        const key = trimmed.substring(0, equalsIndex).trim();
        let value = trimmed.substring(equalsIndex + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        process.env[key] = value;
      }
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const geminiApiKey = process.env.GEMINI_API_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Missing Supabase URL or Service Role Key in .env.local');
  process.exit(1);
}

const SELLER_OWNER_ID = '11111111-1111-1111-1111-111111111111';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  global: {
    headers: {
      Authorization: `Bearer ${supabaseServiceKey}`,
    },
  },
});
const ai = geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey }) : null;

interface PropertyData {
  address: string;
  city: string;
  state: string;
  zip_code: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  square_feet: number;
  property_type: string;
  description: string;
  features: Record<string, unknown>;
  photos: string[];
  status: string;
}

async function seedDatabase() {
  console.log('🚀 Starting Realtor Data Ingestion into Supabase...');

  // Authenticate as seller user to satisfy RLS policies
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'seller.sarah@dwellingly.ai',
    password: 'password123',
  });

  if (authError || !authData.user) {
    console.warn('Seller authentication warning:', authError?.message || 'No user session');
  } else {
    console.log('Successfully authenticated as Seller:', authData.user.email);
  }

  const dataPath = path.resolve(process.cwd(), 'scripts', 'seed_data.json');
  if (!fs.existsSync(dataPath)) {
    console.error(`Error: Seed data file not found at ${dataPath}. Please run process_realtor_data.py first.`);
    process.exit(1);
  }

  const rawData = fs.readFileSync(dataPath, 'utf8');
  const properties: PropertyData[] = JSON.parse(rawData);

  console.log(`Loaded ${properties.length} property records to ingest.`);

  let insertedCount = 0;
  let vectorCount = 0;

  for (let i = 0; i < properties.length; i++) {
    const prop = properties[i];

    // 1. Insert property into public.properties
    const { data: insertedProp, error: insertError } = await supabase
      .from('properties')
      .insert({
        owner_id: SELLER_OWNER_ID,
        address: prop.address,
        city: prop.city,
        state: prop.state,
        zip_code: prop.zip_code,
        price: prop.price,
        bedrooms: prop.bedrooms,
        bathrooms: prop.bathrooms,
        square_feet: prop.square_feet,
        property_type: prop.property_type,
        description: prop.description,
        features: prop.features,
        photos: prop.photos,
        status: prop.status,
      })
      .select('id')
      .single();

    if (insertError) {
      console.warn(`[${i + 1}/${properties.length}] Failed to insert ${prop.address}, ${prop.city}:`, insertError.message, insertError.details, insertError.hint, insertError.code);
      if (i === 0) {
        console.error('Full Insert Error:', JSON.stringify(insertError, null, 2));
      }
      continue;
    }

    insertedCount++;
    const propertyId = insertedProp.id;

    // 2. Build summary for vector embedding
    const contentSummary = `${prop.bedrooms} bed ${prop.bathrooms} bath ${prop.property_type.replace('_', ' ')} home in ${prop.city}, ${prop.state} (${prop.zip_code}). Price: $${prop.price.toLocaleString()}. Size: ${prop.square_feet} sq ft. Features: ${JSON.stringify(prop.features)}. ${prop.description}`;

    // 3. Generate vector embedding if Gemini API Key is available
    if (ai) {
      try {
        const response = await ai.models.embedContent({
          model: 'gemini-embedding-001',
          contents: contentSummary,
          config: {
            outputDimensionality: 768,
          },
        });

        const embeddingValues = response.embeddings?.[0]?.values;
        if (embeddingValues) {
          const { error: vectorError } = await supabase.from('property_vectors').insert({
            property_id: propertyId,
            content_summary: contentSummary,
            embedding: embeddingValues,
          });

          if (!vectorError) {
            vectorCount++;
          } else {
            console.warn(`Vector insert error for property ID ${propertyId}:`, vectorError.message);
          }
        }
      } catch (embErr: unknown) {
        const msg = embErr instanceof Error ? embErr.message : String(embErr);
        console.warn(`Embedding generation error for property ID ${propertyId}:`, msg);
      }
    }

    if ((i + 1) % 10 === 0 || i === properties.length - 1) {
      console.log(`Progress: ${i + 1}/${properties.length} processed. (Inserted: ${insertedCount}, Vectorized: ${vectorCount})`);
    }
  }

  console.log(`\n🎉 Ingestion complete!`);
  console.log(`Total Properties Inserted: ${insertedCount}`);
  console.log(`Total Vector Embeddings Stored: ${vectorCount}`);
}

seedDatabase().catch((err) => {
  console.error('Fatal seed script error:', err);
  process.exit(1);
});
