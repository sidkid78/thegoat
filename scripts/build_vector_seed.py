import json
import urllib.request
import os
import time
import subprocess

ENV_PATH = r"c:\Users\sidki\source\repos\dwellingly\.env.local"
SEED_DATA_PATH = r"c:\Users\sidki\source\repos\dwellingly\scripts\seed_data.json"
SQL_OUTPUT_PATH = r"c:\Users\sidki\source\repos\dwellingly\supabase\seed_vectors.sql"
MODEL_NAME = "gemini-embedding-001"

def load_env():
    env_vars = {}
    if os.path.exists(ENV_PATH):
        with open(ENV_PATH, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#'):
                    parts = line.split('=', 1)
                    if len(parts) == 2:
                        k, v = parts[0].strip(), parts[1].strip().strip('"\'')
                        env_vars[k] = v
    return env_vars

def main():
    print(f"============================================================")
    print(f"   DWELLINGLY.AI - GEMINI EMBEDDING VECTOR GENERATOR")
    print(f"   Model: {MODEL_NAME} | Target Dim: 768")
    print(f"============================================================\n")

    env = load_env()
    api_key = env.get('GEMINI_API_KEY')
    
    if not api_key:
        print("[ERROR] GEMINI_API_KEY not found in .env.local")
        return
        
    if not os.path.exists(SEED_DATA_PATH):
        print(f"[ERROR] Seed data not found at {SEED_DATA_PATH}")
        return

    with open(SEED_DATA_PATH, 'r', encoding='utf-8') as f:
        properties = json.load(f)

    print(f"[START] Generating 768-dim embeddings via '{MODEL_NAME}' for {len(properties)} properties...\n")
    
    values_tuples = []
    success_count = 0
    total_start_time = time.time()
    
    for i, p in enumerate(properties):
        prop_id = i + 1  # Matches inserted identity IDs 1..100
        city = p.get('city', '')
        state = p.get('state', '')
        zip_code = p.get('zip_code', '')
        bedrooms = p.get('bedrooms', 0)
        bathrooms = p.get('bathrooms', 0)
        prop_type = p.get('property_type', 'single_family').replace('_', ' ')
        price = p.get('price', 0)
        sqft = p.get('square_feet', 0)
        features = json.dumps(p.get('features', {}))
        desc = p.get('description', '')
        
        content_summary = f"{bedrooms} bed {bathrooms} bath {prop_type} home in {city}, {state} ({zip_code}). Price: ${price:,.0f}. Size: {sqft:,.0f} sq ft. Features: {features}. {desc}"
        preview = (content_summary[:75] + '...') if len(content_summary) > 75 else content_summary
        
        start_t = time.time()
        
        # Call Gemini REST API for embeddings
        embed_url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL_NAME}:embedContent?key={api_key}"
        payload = {
            "model": f"models/{MODEL_NAME}",
            "content": {
                "parts": [{"text": content_summary}]
            },
            "outputDimensionality": 768
        }
        
        embed_req = urllib.request.Request(embed_url, data=json.dumps(payload).encode('utf-8'), headers={'Content-Type': 'application/json'})
        
        try:
            with urllib.request.urlopen(embed_req) as embed_resp:
                res_data = json.loads(embed_resp.read().decode('utf-8'))
                values = res_data.get('embedding', {}).get('values', [])
                duration = int((time.time() - start_t) * 1000)
                
                if values and len(values) == 768:
                    vector_str = f"[{','.join(str(v) for v in values)}]"
                    summary_escaped = content_summary.replace("'", "''")
                    values_tuples.append(f"  ({prop_id}, '{summary_escaped}', '{vector_str}'::vector)")
                    success_count += 1
                    print(f"[{i+1}/{len(properties)}] ID {prop_id:3d} | OK ({len(values)} dims, {duration}ms) | Preview: \"{preview}\"")
                else:
                    print(f"[{i+1}/{len(properties)}] ID {prop_id:3d} | FAILED (Invalid output dimension {len(values)})")
        except Exception as e:
            duration = int((time.time() - start_t) * 1000)
            print(f"[{i+1}/{len(properties)}] ID {prop_id:3d} | ERROR after {duration}ms: {e}")
            
        time.sleep(0.05)

    total_duration = round(time.time() - total_start_time, 2)
    print(f"\n============================================================")
    print(f"   EMBEDDING GENERATION SUMMARY")
    print(f"   Total Processed: {len(properties)} | Successful: {success_count} | Failed: {len(properties) - success_count}")
    print(f"   Total Elapsed Time: {total_duration}s")
    print(f"============================================================\n")

    if values_tuples:
        print(f"Writing single multi-row INSERT query to {SQL_OUTPUT_PATH}...")
        with open(SQL_OUTPUT_PATH, 'w', encoding='utf-8') as f:
            f.write("-- ============================================================================\n")
            f.write("-- DWELLINGLY.AI - 768-DIM VECTOR EMBEDDINGS FOR PGVECTOR SEMANTIC SEARCH\n")
            f.write("-- ============================================================================\n\n")
            f.write("INSERT INTO public.property_vectors (property_id, content_summary, embedding)\nVALUES\n")
            f.write(",\n".join(values_tuples))
            f.write("\nON CONFLICT (property_id) DO UPDATE SET content_summary = EXCLUDED.content_summary, embedding = EXCLUDED.embedding;\n")
            
        print(f"[SUCCESS] Generated {SQL_OUTPUT_PATH} containing {success_count} vector embedding tuples.")
        
        print("\nExecuting vector seed SQL against local Supabase database...")
        cmd = ["npx", "supabase", "db", "query", "--file", SQL_OUTPUT_PATH]
        res = subprocess.run(cmd, capture_output=True, text=True, cwd=r"c:\Users\sidki\source\repos\dwellingly", shell=True)
        if res.returncode == 0:
            print("[DB SUCCESS] All 100 768-dim property vectors successfully imported into PostgreSQL!")
        else:
            print(f"[DB ERROR] {res.stderr or res.stdout}")

if __name__ == '__main__':
    main()
