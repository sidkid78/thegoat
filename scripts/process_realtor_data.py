import csv
import json
import random
import os

CSV_PATH = r"c:\Users\sidki\source\repos\dwellingly\data\realtor-data.zip.csv"
SQL_OUTPUT_PATH = r"c:\Users\sidki\source\repos\dwellingly\supabase\seed_realtor.sql"
TS_OUTPUT_PATH = r"c:\Users\sidki\source\repos\dwellingly\scripts\seed_data.json"

REAL_ESTATE_PHOTOS = [
    "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9",
    "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c",
    "https://images.unsplash.com/photo-1567496898669-ee935f5f647a",
    "https://images.unsplash.com/photo-1512917774080-9991f1c4c750",
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c",
    "https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b",
    "https://images.unsplash.com/photo-1600585152220-90363fe7e115",
    "https://images.unsplash.com/photo-1600573472592-401b489a3cdc",
    "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3",
    "https://images.unsplash.com/photo-1580587771525-78b9dba3b914",
    "https://images.unsplash.com/photo-1513694203232-719a280e022f",
    "https://images.unsplash.com/photo-1564013799919-ab600027ffc6",
    "https://images.unsplash.com/photo-1570129477492-45c003edd2be",
    "https://images.unsplash.com/photo-1572120360610-d971b9d7767c",
]

TARGET_STATE = "Texas"
TARGET_COUNT = 100

# Austin metro (city, county) — filled first so the demo actually centers on
# Austin; the rest of the 100 slots are backfilled from the wider Texas pool.
AUSTIN_METRO_CITIES = {
    "austin", "round rock", "cedar park", "pflugerville", "georgetown",
    "leander", "kyle", "buda", "san marcos", "dripping springs", "manor",
    "hutto", "lakeway", "bee cave", "taylor",
}

random.seed(42)

def determine_property_type(sqft, bed, bath):
    if sqft < 1200 and bath <= 1.5:
        return 'condo'
    elif sqft < 1800 and bed <= 3:
        return 'townhouse'
    elif sqft > 3500 and bed >= 4:
        return 'single_family'
    else:
        return random.choice(['single_family', 'single_family', 'townhouse'])

def generate_description(city, state, bed, bath, sqft, prop_type, price):
    formatted_price = f"${price:,.0f}"
    templates = [
        f"Stunning {bed}-bedroom, {bath}-bathroom {prop_type.replace('_', ' ')} located in prime {city}, {state}. Featuring {sqft:,.0f} sq. ft. of living space, natural sunlight, upgraded kitchen amenities, and modern finishes throughout.",
        f"Exceptional value in {city}, {state}! This beautiful {sqft:,.0f} sq. ft. home boasts {bed} spacious bedrooms, {bath} baths, open-concept living area, and private outdoor space.",
        f"Charming {prop_type.replace('_', ' ')} offering {bed} beds and {bath} baths in desirable {city}, {state}. High ceilings, energy-efficient appliances, attached garage, and convenient access to local dining and parks.",
        f"Modern retreat in the heart of {city}, {state}. Offers {sqft:,.0f} square feet with {bed} bedrooms, {bath} bathrooms, updated flooring, and high-end fixtures."
    ]
    return random.choice(templates)

def process_csv():
    valid_rows = []
    seen_addresses = set()
    
    print(f"Reading realtor-data.zip.csv, filtering to {TARGET_STATE}...")
    with open(CSV_PATH, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader):
            try:
                status = row.get('status', '').strip()
                if status != 'for_sale':
                    continue

                state = row.get('state', '').strip()
                if state != TARGET_STATE:
                    continue
                state = "TX"  # normalize to match the hand-seeded demo listings

                price = float(row.get('price', 0))
                bed = float(row.get('bed', 0))
                bath = float(row.get('bath', 0))
                sqft = float(row.get('house_size', 0))
                city = row.get('city', '').strip()
                zip_code = row.get('zip_code', '').strip()
                street_id = row.get('street', '').strip()

                if not (50000 <= price <= 5000000):
                    continue
                if not (1 <= bed <= 8 and 1 <= bath <= 8):
                    continue
                if not (400 <= sqft <= 12000):
                    continue
                if not city or not state or not zip_code:
                    continue

                # Format street address safely
                street_num = int(float(street_id)) % 9000 + 100 if street_id and street_id != '' else random.randint(100, 9999)
                street_name = random.choice(["Main St", "Oak Ave", "Maple Dr", "Washington Blvd", "Highland Rd", "Park Ave", "Cedar St", "Pine Rd", "Elm St", "Sunset Blvd"])
                address = f"{street_num} {street_name}"
                
                dedup_key = f"{address}-{city}-{state}".lower()
                if dedup_key in seen_addresses:
                    continue
                seen_addresses.add(dedup_key)
                
                prop_type = determine_property_type(sqft, bed, bath)
                desc = generate_description(city, state, int(bed), bath, sqft, prop_type, price)
                
                features = {
                    "yearBuilt": random.randint(1990, 2024),
                    "hasPool": random.choice([True, False, False]),
                    "garageSpaces": random.randint(1, 3),
                    "centralHeating": True,
                    "centralAir": True,
                    "hoaFeeMonthly": random.choice([0, 0, 150, 250, 380])
                }
                
                valid_rows.append({
                    "address": address,
                    "city": city,
                    "state": state,
                    "zip_code": zip_code,
                    "price": price,
                    "bedrooms": int(bed),
                    "bathrooms": bath,
                    "square_feet": int(sqft),
                    "property_type": prop_type,
                    "description": desc,
                    "features": features,
                    "photos": [],
                    "status": "active"
                })
            except (ValueError, TypeError):
                continue

    print(f"Found {len(valid_rows)} qualifying {TARGET_STATE} listings.")

    # Fill mostly from Austin metro, backfill the remainder from the rest of Texas.
    austin_rows = [r for r in valid_rows if r['city'].lower() in AUSTIN_METRO_CITIES]
    other_rows = [r for r in valid_rows if r['city'].lower() not in AUSTIN_METRO_CITIES]
    random.shuffle(austin_rows)
    random.shuffle(other_rows)

    selected = austin_rows[:TARGET_COUNT] + other_rows[:max(0, TARGET_COUNT - len(austin_rows))]
    random.shuffle(selected)
    valid_rows = selected[:TARGET_COUNT]

    print(f"Selected {len(valid_rows)} listings "
          f"({sum(1 for r in valid_rows if r['city'].lower() in AUSTIN_METRO_CITIES)} Austin metro).")

    # There are only 14 stock photos to go around, and PropertyCard only ever
    # renders photos[0] on the search grid. Independent random.sample() per
    # row let one image cluster onto up to a third of all cards by chance —
    # assign the cover photo round-robin instead so the pool spreads evenly.
    for i, row in enumerate(valid_rows):
        cover = REAL_ESTATE_PHOTOS[i % len(REAL_ESTATE_PHOTOS)]
        rest = [p for p in REAL_ESTATE_PHOTOS if p != cover]
        row['photos'] = [cover] + random.sample(rest, min(2, len(rest)))

    # Save JSON data for seed.ts script
    with open(TS_OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(valid_rows, f, indent=2)
        
    # Generate SQL file
    with open(SQL_OUTPUT_PATH, 'w', encoding='utf-8') as f:
        f.write("-- ============================================================================\n")
        f.write("-- DWELLINGLY.AI - SEED REALTOR DATASET (Extracted from realtor-data.zip.csv)\n")
        f.write("-- ============================================================================\n\n")
        f.write("INSERT INTO public.properties (address, city, state, zip_code, price, bedrooms, bathrooms, square_feet, property_type, description, features, photos, status)\nVALUES\n")
        
        values_list = []
        for p in valid_rows:
            desc_escaped = p['description'].replace("'", "''")
            address_escaped = p['address'].replace("'", "''")
            city_escaped = p['city'].replace("'", "''")
            state_escaped = p['state'].replace("'", "''")
            features_json = json.dumps(p['features']).replace("'", "''")
            photos_json = json.dumps(p['photos']).replace("'", "''")
            
            val = f"  ('{address_escaped}', '{city_escaped}', '{state_escaped}', '{p['zip_code']}', {p['price']}, {p['bedrooms']}, {p['bathrooms']}, {p['square_feet']}, '{p['property_type']}', '{desc_escaped}', '{features_json}'::jsonb, '{photos_json}'::jsonb, 'active')"
            values_list.append(val)
            
        f.write(",\n".join(values_list))
        f.write(";\n")
        
    print(f"Saved {SQL_OUTPUT_PATH} and {TS_OUTPUT_PATH}")

if __name__ == "__main__":
    process_csv()
