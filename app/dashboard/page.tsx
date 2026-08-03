import { createClient } from '@/lib/supabase/server';
import { DashboardView } from '@/components/dashboard/DashboardView';

/**
 * All queries are scoped by RLS to the signed-in user, so no explicit user
 * filter is needed here. Signed-out visitors get empty collections rather than
 * fabricated sample rows.
 */
export default async function DashboardPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let user: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let favorites: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let offers: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let viewings: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cmaReports: any[] = [];

  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;

    if (user) {
      const [favRes, offerRes, viewRes, cmaRes] = await Promise.all([
        supabase
          .from('favorites')
          .select('property_id, created_at, properties (id, address, city, state, price, photos, bedrooms, bathrooms, square_feet)')
          .order('created_at', { ascending: false }),
        supabase
          .from('offers')
          .select('id, offer_amount, status, created_at, proposed_closing_date, properties (address, city, state)')
          .order('created_at', { ascending: false }),
        supabase
          .from('viewings')
          .select('id, scheduled_at, status, created_at, properties (address, city, state)')
          .order('scheduled_at', { ascending: false }),
        supabase
          .from('cma_reports')
          .select('id, estimated_valuation, created_at, properties (address)')
          .order('created_at', { ascending: false }),
      ]);

      favorites = favRes.data ?? [];
      offers = offerRes.data ?? [];
      viewings = viewRes.data ?? [];
      cmaReports = cmaRes.data ?? [];
    }
  } catch {
    // Fall through with empty collections.
  }

  // Server Component: rendered once per request, so reading the clock here is
  // deterministic for the response and keeps `Date.now()` out of client render
  // (which would either be impure or cause a hydration mismatch).
  // eslint-disable-next-line react-hooks/purity
  const renderedAt = Date.now();

  return (
    <DashboardView
      user={user}
      favorites={favorites}
      offers={offers}
      viewings={viewings}
      cmaReports={cmaReports}
      now={renderedAt}
    />
  );
}
