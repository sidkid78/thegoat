import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ai, GEMINI_MODELS } from '@/lib/ai/client';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: offers, error } = await supabase
      .from('offers')
      .select(`
        *,
        properties (address, city, price, photos)
      `)
      .eq('buyer_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ offers });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { propertyId, offerAmount, earnestMoney, contingencies, proposedClosingDate } = body;

    // AI Risk & Compliance Assessment using Gemini 3 Pro
    const reviewPrompt = `
Analyze the following real estate offer submission for potential risks and contingency gaps:
- Offer Amount: $${offerAmount}
- Earnest Money Deposit: $${earnestMoney}
- Contingencies Requested: ${JSON.stringify(contingencies)}
- Proposed Closing Date: ${proposedClosingDate}

Provide brief contractual insights and risk score (1-100).
Return JSON: { "riskScore": number, "insights": string[], "suggestedContingencies": string[] }
`;

    const aiReviewResponse = await ai.models.generateContent({
      model: GEMINI_MODELS.REASONING_PRO,
      contents: reviewPrompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    let aiAssessment = {};
    if (aiReviewResponse.text) {
      aiAssessment = JSON.parse(aiReviewResponse.text);
    }

    // Persist offer to Supabase
    const { data: offer, error: insertError } = await supabase
      .from('offers')
      .insert({
        property_id: propertyId,
        buyer_id: user.id,
        offer_amount: offerAmount,
        earnest_money: earnestMoney,
        contingencies,
        proposed_closing_date: proposedClosingDate,
        status: 'submitted',
        ai_risk_assessment: aiAssessment,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }

    return NextResponse.json({ offer }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}