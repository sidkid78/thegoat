import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { AuthForm } from '@/components/auth/AuthForm';
import { createClient } from '@/lib/supabase/server';
import { safeRedirectPath } from '@/lib/safe-redirect';

export const metadata: Metadata = { title: 'Sign in - Dwellingly.ai' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const destination = safeRedirectPath(next);

  // Already signed in -- send them on instead of showing a form that would
  // silently replace their session.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect(destination);

  return <AuthForm mode="signin" next={destination} />;
}
