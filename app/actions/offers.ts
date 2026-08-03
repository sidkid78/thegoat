'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function submitOfferAction(payload: {
  propertyId: number;
  offerAmount: number;
  earnestMoney: number;
  contingencies: string[];
  proposedClosingDate: string;
}) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: 'Authentication required' };
  }

  const { data, error } = await supabase
    .from('offers')
    .insert({
      property_id: payload.propertyId,
      buyer_id: user.id,
      offer_amount: payload.offerAmount,
      earnest_money: payload.earnestMoney,
      contingencies: payload.contingencies,
      proposed_closing_date: payload.proposedClosingDate,
      status: 'submitted',
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/dashboard/offers');
  return { success: true, offer: data };
}