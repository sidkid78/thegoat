import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { OfferWizard } from '@/components/offer/OfferWizard';

/**
 * Guided offer flow. The AI Strategy Guide range and the Market Context comps
 * both come from a previously generated CMA for this property (RLS-scoped), so
 * nothing on the page is invented — if no CMA exists the guide says so.
 */
export default async function OfferPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const propertyId = Number(id);
  if (!Number.isFinite(propertyId)) notFound();

  const supabase = await createClient();

  const { data: property } = await supabase
    .from('properties')
    .select('*')
    .eq('id', propertyId)
    .single();

  if (!property) notFound();

  const { data: cma } = await supabase
    .from('cma_reports')
    .select('estimated_valuation, valuation_range_low, valuation_range_high, comparable_property_ids, report_data, created_at')
    .eq('property_id', propertyId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let comps: any[] = [];
  if (cma?.comparable_property_ids?.length) {
    const { data } = await supabase
      .from('properties')
      .select('id, address, city, state, price, bedrooms, bathrooms, square_feet')
      .in('id', cma.comparable_property_ids)
      .limit(4);
    comps = data ?? [];
  }

  return <OfferWizard property={property} cma={cma ?? null} comps={comps} />;
}
