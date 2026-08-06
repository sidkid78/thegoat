'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { toE164 } from '@/lib/integrations/twilio';

/** Roles a visitor may pick at signup. `agent`/`admin` are assigned, not chosen. */
const SIGNUP_ROLES = ['buyer', 'seller'] as const;
type SignupRole = (typeof SIGNUP_ROLES)[number];

export type AuthResult = { success: true } | { success: false; error: string };

export async function signInAction(formData: FormData): Promise<AuthResult> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    return { success: false, error: 'Enter your email and password.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Supabase deliberately returns the same error whether the address is
    // unknown or the password is wrong; passing it through keeps it that way
    // rather than confirming which accounts exist.
    return { success: false, error: error.message };
  }

  revalidatePath('/', 'layout');
  return { success: true };
}

/**
 * Signup writes `full_name` and `role` into the auth user's metadata, where the
 * `handle_new_user` trigger (supabase/migrations/20240101000000_init_schema.sql)
 * reads them to create the matching `profiles` row. Setting them here is the
 * only way in -- the app has no INSERT grant on `profiles`, by design.
 */
export async function signUpAction(formData: FormData): Promise<AuthResult> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const fullName = String(formData.get('fullName') ?? '').trim();
  const rawRole = String(formData.get('role') ?? 'buyer');

  if (!fullName) return { success: false, error: 'Enter your name.' };
  if (!email) return { success: false, error: 'Enter your email address.' };
  // Matches `minimum_password_length` in supabase/config.toml. Checked here too
  // so the message is specific instead of a generic "weak password" from the API.
  if (password.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters.' };
  }

  const role: SignupRole = (SIGNUP_ROLES as readonly string[]).includes(rawRole)
    ? (rawRole as SignupRole)
    : 'buyer';

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, role } },
  });

  if (error) return { success: false, error: error.message };

  // `enable_confirmations = false` locally, so signUp returns a live session and
  // the user is already signed in. With confirmations on there's no session yet
  // and they must click the emailed link first -- say so rather than redirecting
  // them into an app that still thinks they're a guest.
  if (!data.session) {
    return { success: false, error: 'Check your email to confirm your account before signing in.' };
  }

  revalidatePath('/', 'layout');
  return { success: true };
}

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
