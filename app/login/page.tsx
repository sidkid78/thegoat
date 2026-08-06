import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { AuthForm } from '@/components/auth/AuthForm';
import { createClient } from '@/lib/supabase/server';
import { safeRedirectPath } from '@/lib/safe-redirect';

export const metadata: Metadata = { title: 'Sign in - Dwellingly.ai' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const destination = safeRedirectPath(next);

  // Already signed in -- send them on instead of showing a form that would
  // silently replace their session.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect(destination);

  // `/auth/confirm` redirects here with the reason when a link is expired or
  // already used, so the user finds out why instead of hitting a blank form.
  return <AuthForm mode="signin" next={destination} initialError={error ?? null} />;
}
