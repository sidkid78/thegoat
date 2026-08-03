'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

/**
 * Toggles a user's favorite status for a property
 */
export async function toggleFavoriteAction(propertyId: number) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error('Authentication required');
  }

  // Check if existing favorite exists
  const { data: existing } = await supabase
    .from('favorites')
    .select('id')
    .eq('user_id', user.id)
    .eq('property_id', propertyId)
    .single();

  if (existing) {
    // Remove favorite
    await supabase.from('favorites').delete().eq('id', existing.id);
    revalidatePath(`/properties/${propertyId}`);
    return { isFavorite: false };
  } else {
    // Add favorite
    await supabase.from('favorites').insert({
      user_id: user.id,
      property_id: propertyId,
    });
    revalidatePath(`/properties/${propertyId}`);
    return { isFavorite: true };
  }
}

/**
 * Schedules a viewing for a home
 */
export async function scheduleViewingAction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error('Authentication required');
  }

  const propertyId = parseInt(formData.get('propertyId') as string, 10);
  const scheduledAt = formData.get('scheduledAt') as string;
  const notes = formData.get('notes') as string;

  const { data, error } = await supabase
    .from('viewings')
    .insert({
      user_id: user.id,
      property_id: propertyId,
      scheduled_at: scheduledAt,
      notes: notes || 'Scheduled via Web Portal',
      status: 'scheduled',
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath(`/properties/${propertyId}`);
  return { success: true, viewing: data };
}