'use server';

import { createClient } from '@/lib/supabase/server';
import { generateCmaReport } from '@/lib/ai/cma';
import { revalidatePath } from 'next/cache';

/**
 * Server Action to trigger an automated CMA valuation report
 */
export async function requestCmaAction(propertyId: number) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: 'User must be logged in to request a CMA.' };
  }

  try {
    const result = await generateCmaReport(propertyId, user.id);
    revalidatePath(`/properties/${propertyId}`);
    revalidatePath('/dashboard');
    return {
      success: true,
      cmaReportId: result.cmaReportId,
      report: result.report,
    };
  } catch (error: any) {
    return { success: false, error: (error as Error).message || 'CMA Generation failed' };
  }
}