import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateCmaReport } from '@/lib/ai/cma';

// GET /api/properties/[id]/cma - Fetch existing CMA reports for a property
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const propertyId = parseInt(id, 10);
    const supabase = await createClient();

    const { data: reports, error } = await supabase
      .from('cma_reports')
      .select('*')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ cmaReports: reports });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/properties/[id]/cma - Trigger Gemini 3 Pro reasoning to generate a new CMA
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const propertyId = parseInt(id, 10);
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Call AI service (gemini-3-pro-preview with thinking budget)
    const result = await generateCmaReport(propertyId, user.id);

    return NextResponse.json({
      success: true,
      cmaReportId: result.cmaReportId,
      report: result.report,
    }, { status: 201 });
  } catch (err: any) {
    console.error('CMA Generation Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to generate CMA report' }, { status: 500 });
  }
}