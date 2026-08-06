import { createClient } from '@/lib/supabase/server';
import { PropertyDetail } from '@/components/property/PropertyDetail';
import { notFound } from 'next/navigation';

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const propertyId = parseInt(id, 10);
  const supabase = await createClient();

  const { data: property } = await supabase
    .from('properties')
    .select('*')
    .eq('id', propertyId)
    .single();

  if (!property) {
    notFound();
  }

  const { data: cmaReport } = await supabase
    .from('cma_reports')
    .select('*')
    .eq('property_id', propertyId)
    .order('created_at', { ascending: false })
    .maybeSingle();

  // Zip-level market history, oldest first so the chart reads left to right.
  // Keyed on the listing's zip rather than its id -- this is area data, and no
  // per-property sale history exists for these seeded listings.
  const { data: trends } = await supabase
    .from('market_trends')
    .select('period_begin, median_sale_price, median_ppsf, homes_sold, median_dom, median_sale_price_yoy')
    .eq('zip_code', property.zip_code)
    .order('period_begin', { ascending: true });

  const marketTrends = (trends ?? []).map((row) => ({
    periodBegin: row.period_begin as string,
    medianSalePrice: row.median_sale_price === null ? null : Number(row.median_sale_price),
    medianPpsf: row.median_ppsf === null ? null : Number(row.median_ppsf),
    homesSold: row.homes_sold,
    medianDom: row.median_dom,
    medianSalePriceYoy:
      row.median_sale_price_yoy === null ? null : Number(row.median_sale_price_yoy),
  }));

  return (
    <PropertyDetail
      property={property}
      initialCma={cmaReport?.report_data}
      marketTrends={marketTrends}
    />
  );
}