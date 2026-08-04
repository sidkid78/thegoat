/**
 * Shared between the Property Evaluation Hub client component and the server
 * actions that score against it. It lives here rather than in
 * `app/actions/evaluation.ts` because a `'use server'` module may only export
 * async functions -- exporting a plain const from one fails the build with
 * "A 'use server' file can only export async functions, found object."
 */
export interface BuyerPreferences {
  priorities: string[];
  notes: string;
}

/**
 * The buying priorities a shortlist is scored against. The phrases match the
 * ones the search page folds into its embedded query, so a property that scored
 * well in search scores well here too.
 */
export const BUYER_PRIORITIES: { id: string; label: string; phrase: string }[] = [
  { id: 'appreciation', label: 'High Appreciation', phrase: 'strong long-term value appreciation' },
  { id: 'cashflow', label: 'Cash Flow Focus', phrase: 'strong rental income potential' },
  { id: 'renovation', label: 'Renovation Potential', phrase: 'renovation and improvement potential' },
  { id: 'turnkey', label: 'Move-in Ready', phrase: 'turnkey move-in ready condition, recently updated' },
  { id: 'space', label: 'Room to Grow', phrase: 'generous square footage and large lot' },
];

/** Composes the free text and selected priorities into one embeddable string. */
export function composePreferenceText(prefs: BuyerPreferences): string {
  const phrases = BUYER_PRIORITIES.filter((p) => prefs.priorities.includes(p.id)).map((p) => p.phrase);
  return [prefs.notes.trim(), ...phrases].filter(Boolean).join('. ');
}
