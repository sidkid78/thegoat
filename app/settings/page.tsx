import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { SettingsView } from '@/components/settings/SettingsView';
import type { BuyerPreferences } from '@/lib/buyer-preferences';

export const metadata: Metadata = { title: 'Settings - Dwellingly.ai' };

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Nothing on this page means anything without an identity, and every control
  // writes to the signed-in profile -- so send guests to sign in rather than
  // rendering a form that cannot save.
  if (!user) redirect('/login?next=/settings');

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email, role, phone, metadata, created_at')
    .eq('id', user.id)
    .single();

  // Recently viewed, shown so the privacy control is concrete: the user can see
  // exactly what was recorded rather than trusting a description of it.
  const { data: views } = await supabase
    .from('property_views')
    .select('property_id, view_count, last_viewed_at, properties (address, city, state)')
    .eq('user_id', user.id)
    .order('last_viewed_at', { ascending: false })
    .limit(10);

  const { count: viewCount } = await supabase
    .from('property_views')
    .select('property_id', { count: 'exact', head: true })
    .eq('user_id', user.id);

  const metadata = (profile?.metadata ?? {}) as Record<string, unknown>;

  return (
    <SettingsView
      profile={{
        fullName: profile?.full_name ?? '',
        email: profile?.email ?? user.email ?? '',
        role: profile?.role ?? 'buyer',
        phone: profile?.phone ?? null,
        memberSince: profile?.created_at ?? null,
      }}
      preferences={(metadata.buyerPreferences as BuyerPreferences | undefined) ?? null}
      trackActivity={metadata.trackActivity !== false}
      recentViews={(views ?? []).map((v) => ({
        propertyId: v.property_id as number,
        viewCount: v.view_count as number,
        lastViewedAt: v.last_viewed_at as string,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        address: (v.properties as any)?.address ?? 'Removed listing',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        city: (v.properties as any)?.city ?? '',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        state: (v.properties as any)?.state ?? '',
      }))}
      totalViews={viewCount ?? 0}
    />
  );
}
