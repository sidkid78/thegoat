import { createClient } from '@/lib/supabase/server';
import { PropertySearch } from '@/components/search/PropertySearch';

export default async function SearchPage() {
  const supabase = await createClient();

  const { data: properties } = await supabase
    .from('properties')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  return <PropertySearch initialProperties={properties || []} />;
}