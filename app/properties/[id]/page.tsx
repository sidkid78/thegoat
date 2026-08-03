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

  return <PropertyDetail property={property} initialCma={cmaReport?.report_data} />;
}