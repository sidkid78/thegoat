'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { toE164 } from '@/lib/integrations/twilio';

/**
 * Sets the number SMS notifications go to. Stored in E.164 so Twilio accepts it
 * without re-parsing at send time; an unparseable value is rejected here rather
 * than silently dropped when an alert later fails to send.
 *
 * Passing an empty string clears the number and turns notifications off.
 */
export async function updateNotificationPhoneAction(rawPhone: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false as const, error: 'Authentication required' };

  const trimmed = rawPhone.trim();
  let phone: string | null = null;

  if (trimmed) {
    phone = toE164(trimmed);
    if (!phone) {
      return {
        success: false as const,
        error: 'Enter a valid number, e.g. (512) 555-0192 or +15125550192.',
      };
    }
  }

  const { error } = await supabase.from('profiles').update({ phone }).eq('id', user.id);
  if (error) return { success: false as const, error: error.message };

  revalidatePath('/', 'layout');
  return { success: true as const, phone };
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // The identity lives in cookies that every server component reads, so the
  // whole tree has to re-render rather than just the page that signed out.
  revalidatePath('/', 'layout');
  return { success: true };
}
