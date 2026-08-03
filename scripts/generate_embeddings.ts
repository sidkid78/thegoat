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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const geminiApiKey = process.env.GEMINI_API_KEY || '';

if (!geminiApiKey) {
  console.error('Error: Missing GEMINI_API_KEY in .env.local');
  process.exit(1);
}

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
const ai = new GoogleGenAI({ apiKey: geminiApiKey });

async function generateAllEmbeddings() {
  console.log('🔍 Fetching properties from Supabase...');

  const { data: properties, error } = await supabase
    .from('properties')
    .select('id, address, city, state, zip_code, price, bedrooms, bathrooms, square_feet, property_type, description, features');

  if (error || !properties) {
    console.error('Error fetching properties:', error?.message || 'No properties returned');
    process.exit(1);
  }

  console.log(`Found ${properties.length} properties. Generating 768-dim embeddings via Gemini API...`);

  let count = 0;
  const sqlStatements: string[] = [];

  for (let i = 0; i < properties.length; i++) {
    const p = properties[i];
    const contentSummary = `${p.bedrooms} bed ${p.bathrooms} bath ${p.property_type.replace('_', ' ')} home in ${p.city}, ${p.state} (${p.zip_code}). Price: $${Number(p.price).toLocaleString()}. Size: ${p.square_feet} sq ft. Features: ${JSON.stringify(p.features)}. ${p.description}`;

    try {
      const response = await ai.models.embedContent({
        model: 'gemini-embedding-001',
        contents: contentSummary,
        config: {
          outputDimensionality: 768,
        },
      });

      const embeddingValues = response.embeddings?.[0]?.values;
      if (embeddingValues && embeddingValues.length === 768) {
        const summaryEscaped = contentSummary.replace(/'/g, "''");
        const vectorStr = `[${embeddingValues.join(',')}]`;
        sqlStatements.push(`INSERT INTO public.property_vectors (property_id, content_summary, embedding) VALUES (${p.id}, '${summaryEscaped}', '${vectorStr}'::vector) ON CONFLICT (property_id) DO UPDATE SET content_summary = EXCLUDED.content_summary, embedding = EXCLUDED.embedding;`);
        count++;
      }
    } catch (embErr: unknown) {
      const msg = embErr instanceof Error ? embErr.message : String(embErr);
      console.warn(`[${i + 1}/${properties.length}] Embedding failed for Property ID ${p.id}:`, msg);
    }

    if ((i + 1) % 10 === 0 || i === properties.length - 1) {
      console.log(`Processed ${i + 1}/${properties.length} embeddings (${count} successful).`);
    }
  }

  const sqlFilePath = path.resolve(process.cwd(), 'supabase', 'seed_vectors.sql');
  fs.writeFileSync(sqlFilePath, sqlStatements.join('\n'), 'utf8');

  console.log(`\n✅ Generated vector SQL with ${sqlStatements.length} embeddings at ${sqlFilePath}`);
}

generateAllEmbeddings().catch((err) => {
  console.error('Fatal embedding script error:', err);
  process.exit(1);
});
