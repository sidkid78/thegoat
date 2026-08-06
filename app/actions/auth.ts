'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { toE164 } from '@/lib/integrations/twilio';
import { safeRedirectPath } from '@/lib/safe-redirect';

/** Roles a visitor may pick at signup. `agent`/`admin` are assigned, not chosen. */
const SIGNUP_ROLES = ['buyer', 'seller'] as const;
type SignupRole = (typeof SIGNUP_ROLES)[number];

export type AuthResult =
  | { status: 'ok' }
  | { status: 'error'; error: string }
  /** Signed up, but `enable_confirmations` is on so there's no session yet. */
  | { status: 'confirm-email'; email: string };

export async function signInAction(formData: FormData): Promise<AuthResult> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    return { status: 'error', error: 'Enter your email and password.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Supabase deliberately returns the same error whether the address is
    // unknown or the password is wrong; passing it through keeps it that way
    // rather than confirming which accounts exist.
    return { status: 'error', error: error.message };
  }

  revalidatePath('/', 'layout');
  return { status: 'ok' };
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

  if (!fullName) return { status: 'error', error: 'Enter your name.' };
  if (!email) return { status: 'error', error: 'Enter your email address.' };
  // Matches `minimum_password_length` in supabase/config.toml. Checked here too
  // so the message is specific instead of a generic "weak password" from the API.
  if (password.length < 6) {
    return { status: 'error', error: 'Password must be at least 6 characters.' };
  }

  const role: SignupRole = (SIGNUP_ROLES as readonly string[]).includes(rawRole)
    ? (rawRole as SignupRole)
    : 'buyer';

  // Where the confirmation email should send them back to. Absolute because
  // Supabase requires it, and derived from the request rather than hardcoded so
  // it works on any host. It reaches the template as `{{ .RedirectTo }}`, and
  // `/auth/confirm` reduces it back to a same-origin path before redirecting.
  const requestHeaders = await headers();
  const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host');
  const proto = requestHeaders.get('x-forwarded-proto') ?? 'http';
  const next = safeRedirectPath(String(formData.get('next') ?? ''));
  const emailRedirectTo = host ? `${proto}://${host}${next}` : undefined;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, role }, emailRedirectTo },
  });

  if (error) return { status: 'error', error: error.message };

  // With `enable_confirmations = false` signUp returns a live session and the
  // user is already signed in. With it on there is no session yet and they must
  // click the emailed link, which lands on /auth/confirm. That is a success, not
  // a failure -- reporting it as an error box was wrong.
  if (!data.session) {
    return { status: 'confirm-email', email };
  }

  revalidatePath('/', 'layout');
  return { status: 'ok' };
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
