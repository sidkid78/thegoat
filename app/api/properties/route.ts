import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateEmbedding } from '@/lib/ai/client';

// GET /api/properties
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(req.url);

    const city = searchParams.get('city');
    const minPrice = searchParams.get('minPrice');
    const maxPrice = searchParams.get('maxPrice');
    const bedrooms = searchParams.get('bedrooms');
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    let query = supabase
      .from('properties')
      .select('*, cma_reports(count)', { count: 'exact' });

    if (city) query = query.ilike('city', `%${city}%`);
    if (minPrice) query = query.gte('price', parseFloat(minPrice));
    if (maxPrice) query = query.lte('price', parseFloat(maxPrice));
    if (bedrooms) query = query.gte('bedrooms', parseInt(bedrooms, 10));

    query = query.range(offset, offset + limit - 1).order('created_at', { ascending: false });

    const { data, count, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      properties: data,
      totalCount: count,
      limit,
      offset,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/properties
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    // Construct text representation for pgvector embedding creation
    const textForEmbedding = `
    Property Address: ${body.address}, ${body.city}, ${body.state} ${body.zipCode}.
    Price: $${body.price}. Bedrooms: ${body.bedrooms}. Bathrooms: ${body.bathrooms}.
    Property Type: ${body.propertyType || 'Single Family Home'}.
    Description: ${body.description}.
    Features: ${Array.isArray(body.features) ? body.features.join(', ') : body.features}.
    `;

    const embeddingVector = await generateEmbedding(textForEmbedding);

    const { data: property, error: insertError } = await supabase
      .from('properties')
      .insert({
        seller_id: user.id,
        address: body.address,
        city: body.city,
        state: body.state,
        zip_code: body.zipCode,
        price: body.price,
        bedrooms: body.bedrooms,
        bathrooms: body.bathrooms,
        square_feet: body.squareFeet,
        property_type: body.propertyType || 'Single Family',
        description: body.description,
        features: body.features || [],
        photos: body.photos || [],
        embedding: embeddingVector,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }

    return NextResponse.json({ property }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}