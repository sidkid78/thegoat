'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // The identity lives in cookies that every server component reads, so the
  // whole tree has to re-render rather than just the page that signed out.
  revalidatePath('/', 'layout');
  return { success: true };
}
