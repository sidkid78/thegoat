import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

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
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const geminiApiKey = process.env.GEMINI_API_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const ai = new GoogleGenAI({ apiKey: geminiApiKey });

async function testToolSearch() {
  console.log('🤖 Testing AI searchProperties tool vector search...');

  const query = '3 bedroom home with modern amenities';
  console.log(`Generating embedding for query: "${query}"...`);

  const embRes = await ai.models.embedContent({
    model: 'gemini-embedding-001',
    contents: query,
    config: { outputDimensionality: 768 },
  });

  const queryVector = embRes.embeddings?.[0]?.values;
  if (!queryVector) {
    console.error('Failed to generate query embedding');
    return;
  }

  console.log(`Query vector generated (${queryVector.length} dims). Executing match_properties RPC...`);

  const { data, error } = await supabase.rpc('match_properties', {
    query_embedding: queryVector,
    match_threshold: 0.15,
    match_count: 5,
  });

  if (error) {
    console.error('RPC Search Error:', error);
  } else {
    console.log(`\n✅ RPC Search returned ${data?.length || 0} listings:`);
    data?.forEach((item: any, idx: number) => {
      console.log(`  ${idx + 1}. [${item.similarity.toFixed(4)}] ${item.address}, ${item.city}, ${item.state} - $${Number(item.price).toLocaleString()} (${item.bedrooms} bed, ${item.bathrooms} bath)`);
    });
  }
}

testToolSearch();
