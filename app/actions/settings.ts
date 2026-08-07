'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { toE164 } from '@/lib/integrations/twilio';
import type { BuyerPreferences } from '@/lib/buyer-preferences';

export type SettingsResult = { success: true } | { success: false; error: string };

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

/**
 * Name and notification number. Email is deliberately not editable here --
 * changing it is an auth-level operation that re-triggers confirmation, and
 * `/auth/confirm` would need an `email_change` path before it could be offered
 * honestly. Better absent than present and broken.
 *
 * Role is likewise fixed after signup: it gates the properties INSERT policy,
 * so letting a buyer flip themselves to seller in settings would be a
 * privilege change dressed up as a preference.
 */
export async function updateProfileAction(formData: FormData): Promise<SettingsResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { success: false, error: 'Authentication required' };

  const fullName = String(formData.get('fullName') ?? '').trim();
  if (!fullName) return { success: false, error: 'Name cannot be empty.' };

  const rawPhone = String(formData.get('phone') ?? '').trim();
  let phone: string | null = null;
  if (rawPhone) {
    phone = toE164(rawPhone);
    if (!phone) {
      return {
        success: false,
        error: 'Enter a valid phone number, e.g. (512) 555-0192 or +15125550192.',
      };
    }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ full_name: fullName, phone })
    .eq('id', user.id);

  if (error) return { success: false, error: error.message };

  // The navbar reads the identity in the root layout, so the whole tree needs
  // to re-render, not just this page.
  revalidatePath('/', 'layout');
  return { success: true };
}

/**
 * Buying priorities. The same object `/evaluate` writes -- this is a second
 * door onto one setting, not a second copy of it, so both surfaces stay in
 * agreement and the recommendation shelf picks the change up either way.
 */
export async function updatePreferencesAction(prefs: BuyerPreferences): Promise<SettingsResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { success: false, error: 'Authentication required' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('metadata')
    .eq('id', user.id)
    .single();

  const { error } = await supabase
    .from('profiles')
    .update({ metadata: { ...(profile?.metadata ?? {}), buyerPreferences: prefs } })
    .eq('id', user.id);

  if (error) return { success: false, error: error.message };

  revalidatePath('/settings');
  revalidatePath('/evaluate');
  revalidatePath('/dashboard');
  return { success: true };
}

/**
 * Activity tracking opt-out. Stored as `trackActivity` in profile metadata,
 * which `match_recommendations` and `record_property_view` both read -- so
 * switching it off stops new views being recorded *and* stops existing history
 * influencing recommendations, without waiting for the history to be cleared.
 */
export async function setActivityTrackingAction(enabled: boolean): Promise<SettingsResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { success: false, error: 'Authentication required' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('metadata')
    .eq('id', user.id)
    .single();

  const { error } = await supabase
    .from('profiles')
    .update({ metadata: { ...(profile?.metadata ?? {}), trackActivity: enabled } })
    .eq('id', user.id);

  if (error) return { success: false, error: error.message };

  revalidatePath('/settings');
  revalidatePath('/dashboard');
  return { success: true };
}

/**
 * Erases browsing history for real -- an actual DELETE, not a flag. The table
 * has a DELETE policy scoped to `auth.uid()` specifically so this can work.
 */
export async function clearBrowsingHistoryAction(): Promise<SettingsResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { success: false, error: 'Authentication required' };

  const { error } = await supabase.from('property_views').delete().eq('user_id', user.id);
  if (error) return { success: false, error: error.message };

  revalidatePath('/settings');
  revalidatePath('/dashboard');
  return { success: true };
}
