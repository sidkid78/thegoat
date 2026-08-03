import json
import urllib.request
import os
import time

ENV_PATH = r"c:\Users\sidki\source\repos\dwellingly\.env.local"
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
    supabase_url = env.get('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321')
    service_key = env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if not api_key:
        print("[ERROR] GEMINI_API_KEY not found in .env.local")
        return
        
    properties = []
    print(f"[FETCH] Attempting to query properties from Supabase REST API at {supabase_url}...")
    req = urllib.request.Request(f"{supabase_url}/rest/v1/properties?select=*")
    req.add_header('apikey', service_key)
    req.add_header('Authorization', f"Bearer {service_key}")
    
    try:
        with urllib.request.urlopen(req) as resp:
            properties = json.loads(resp.read().decode('utf-8'))
        print(f"[FETCH SUCCESS] Retrieved {len(properties)} properties from database.")
    except Exception as e:
        print(f"[FETCH WARN] REST API returned ({e}). Falling back to local seed_data.json...")
        seed_path = r"c:\Users\sidki\source\repos\dwellingly\scripts\seed_data.json"
        if os.path.exists(seed_path):
            with open(seed_path, 'r', encoding='utf-8') as f:
                raw_props = json.load(f)
                for idx, item in enumerate(raw_props):
                    item['id'] = idx + 1
                    properties.append(item)
            print(f"[FALLBACK SUCCESS] Loaded {len(properties)} properties from local seed_data.json.")
        else:
            print(f"[FETCH ERROR] Local seed_data.json not found at {seed_path}")
            return

    print(f"\n[START] Generating 768-dim embeddings via '{MODEL_NAME}' for {len(properties)} properties...\n")
    
    sql_statements = []
    success_count = 0
    total_start_time = time.time()
    
    for i, p in enumerate(properties):
        prop_id = p['id']
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
                    
                    # Direct insert into Supabase PostgREST
                    post_url = f"{supabase_url}/rest/v1/property_vectors"
                    post_data = {
                        "property_id": prop_id,
                        "content_summary": content_summary,
                        "embedding": vector_str
                    }
                    post_req = urllib.request.Request(post_url, data=json.dumps(post_data).encode('utf-8'), headers={
                        'apikey': service_key,
                        'Authorization': f"Bearer {service_key}",
                        'Content-Type': 'application/json',
                        'Prefer': 'resolution=merge-duplicates'
                    })
                    
                    try:
                        with urllib.request.urlopen(post_req) as post_resp:
                            success_count += 1
                            print(f"[{i+1}/{len(properties)}] ID {prop_id:3d} | OK ({len(values)} dims, {duration}ms) | Preview: \"{preview}\"")
                    except Exception as post_err:
                        print(f"[{i+1}/{len(properties)}] ID {prop_id:3d} | DB INSERT ERROR after {duration}ms: {post_err}")
                else:
                    print(f"[{i+1}/{len(properties)}] ID {prop_id:3d} | FAILED (Invalid output dimension {len(values)})")
        except Exception as e:
            duration = int((time.time() - start_t) * 1000)
            print(f"[{i+1}/{len(properties)}] ID {prop_id:3d} | ERROR after {duration}ms: {e}")
            
        # Avoid rate-limit spikes
        time.sleep(0.05)

    total_duration = round(time.time() - total_start_time, 2)
    print(f"\n============================================================")
    print(f"   EMBEDDING GENERATION SUMMARY")
    print(f"   Total Processed: {len(properties)} | Successful: {success_count} | Failed: {len(properties) - success_count}")
    print(f"   Total Elapsed Time: {total_duration}s")
    print(f"============================================================\n")

    print(f"Writing SQL statements to {SQL_OUTPUT_PATH}...")
    with open(SQL_OUTPUT_PATH, 'w', encoding='utf-8') as f:
        f.write("-- ============================================================================\n")
        f.write("-- DWELLINGLY.AI - 768-DIM VECTOR EMBEDDINGS FOR PGVECTOR SEMANTIC SEARCH\n")
        f.write("-- ============================================================================\n\n")
        f.write("\n".join(sql_statements))
        f.write("\n")
        
    print(f"[SUCCESS] Generated {SQL_OUTPUT_PATH} containing {success_count} vector embedding SQL statements.")

if __name__ == '__main__':
    main()
