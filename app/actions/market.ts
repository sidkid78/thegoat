'use server';

import { createClient } from '@/lib/supabase/server';
import { forecastPrices } from '@/lib/market/forecast';
import { generateMarketAnalysis, type MarketAnalysis } from '@/lib/ai/market-forecast';

/**
 * On demand rather than on page load: this is a paid reasoning call, and a
 * property page is re-read far more often than a ZIP's monthly median moves.
 * Same pattern as the CMA, the neighborhood vibe, and the offer analysis.
 *
 * The forecast itself is recomputed here rather than trusted from the client --
 * the numbers the model narrates have to come from the database, not from
 * whatever a caller posts.
 */
export async function marketAnalysisAction(
  propertyId: number
): Promise<{ success: true; analysis: MarketAnalysis } | { success: false; error: string }> {
  const supabase = await createClient();

  const { data: property } = await supabase
    .from('properties')
    .select('zip_code, city, state, price')
    .eq('id', propertyId)
    .single();

  if (!property) return { success: false, error: 'Property not found' };

  const { data: rows } = await supabase
    .from('market_trends')
    .select('period_begin, median_sale_price, homes_sold, median_dom')
    .eq('zip_code', property.zip_code)
    .order('period_begin', { ascending: true });

  const series = (rows ?? [])
    .filter((r) => r.median_sale_price !== null)
    .map((r) => ({ periodBegin: r.period_begin as string, medianSalePrice: Number(r.median_sale_price) }));

  const forecast = forecastPrices(series);
  if (!forecast) {
    return { success: false, error: 'Not enough market history in this ZIP to project a trend.' };
  }

  // Two years of context is enough to show the recent shape without spending
  // the whole prompt budget on 2012.
  const recentMonths = (rows ?? [])
    .slice(-24)
    .filter((r) => r.median_sale_price !== null)
    .map((r) => ({
      period: r.period_begin as string,
      medianSalePrice: Number(r.median_sale_price),
      homesSold: r.homes_sold,
      medianDom: r.median_dom,
    }));

  try {
    const analysis = await generateMarketAnalysis({
      zipCode: property.zip_code,
      city: property.city,
      state: property.state,
      listPrice: Number(property.price),
      forecast,
      recentMonths,
    });
    return { success: true, analysis };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
