import { NextRequest, NextResponse } from 'next/server';
import { analyzePropertyImage, generateVirtualStagingImage } from '@/lib/ai/image';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action, imageBase64, mimeType = 'image/jpeg', roomType, designStyle, additionalInstructions } = body;

    if (!imageBase64) {
      return NextResponse.json({ error: 'Missing required imageBase64 field' }, { status: 400 });
    }

    if (action === 'analyze') {
      const analysis = await analyzePropertyImage(imageBase64, mimeType);
      return NextResponse.json({ success: true, analysis });
    } else if (action === 'stage') {
      const stagedImage = await generateVirtualStagingImage({
        originalImageBase64: imageBase64,
        mimeType,
        options: {
          roomType: roomType || 'living_room',
          designStyle: designStyle || 'modern_minimalist',
          additionalInstructions,
        },
      });

      return NextResponse.json({ success: true, stagedImage });
    } else {
      return NextResponse.json({ error: "Invalid action. Use 'analyze' or 'stage'." }, { status: 400 });
    }
  } catch (err: any) {
    console.error('API /api/staging Error:', err);
    return NextResponse.json({ error: err.message || 'Virtual Staging failed' }, { status: 500 });
  }
}