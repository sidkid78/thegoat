import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { AuthForm } from '@/components/auth/AuthForm';
import { createClient } from '@/lib/supabase/server';
import { safeRedirectPath } from '@/lib/safe-redirect';

export const metadata: Metadata = { title: 'Create an account - Dwellingly.ai' };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const destination = safeRedirectPath(next);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect(destination);

  return <AuthForm mode="signup" next={destination} />;
}
