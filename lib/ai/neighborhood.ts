import { ai, GEMINI_MODELS } from './client';

export interface NeighborhoodVibe {
  summary: string;
  /** Real places Maps grounding cited while writing the summary. */
  citations: { name: string; url: string }[];
}

/**
 * A short, Maps-grounded read on what it's like to live at an address, for the
 * shortlist cards on the Property Evaluation Hub.
 *
 * This replaced nothing -- the old `getNeighborhoodStats` tool that fabricated
 * walk scores was deleted rather than reused. `google_maps` is a built-in tool
 * resolved server-side by Gemini, so there's no executor and no function_call
 * step; the cited places come back as `place_citation` annotations on the
 * model_output content blocks.
 */
export async function generateNeighborhoodVibe(location: {
  address: string;
  city: string;
  state: string;
  zipCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}): Promise<NeighborhoodVibe> {
  const formatted = [location.address, location.city, location.state, location.zipCode]
    .filter(Boolean)
    .join(', ');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapsTool: any = { type: 'google_maps' };
  if (location.latitude != null && location.longitude != null) {
    mapsTool.latitude = location.latitude;
    mapsTool.longitude = location.longitude;
  }

  const interaction = await ai.interactions.create({
    model: GEMINI_MODELS.CHAT_FLASH,
    input: `In 40 words or less, describe what it is actually like to live near ${formatted}.

Use the Google Maps tool to ground this in real nearby places. Cover walkability,
the character of the immediate area, and the most notable nearby amenities.
State only what the Maps data supports -- do not invent walk scores, crime
statistics, or school ratings. Write plain prose, no bullet points, no preamble.`,
    tools: [mapsTool],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  // Citations live on the completed interaction's steps, never on the create
  // response's convenience fields -- re-fetch to be sure they're populated.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const full: any = await ai.interactions.get((interaction as any).id);

  const summary: string =
    full?.output_text ?? full?.steps?.at(-1)?.content?.[0]?.text ?? '';

  const seen = new Set<string>();
  const citations: { name: string; url: string }[] = [];
  for (const step of full?.steps ?? []) {
    if (step?.type !== 'model_output') continue;
    for (const block of step.content ?? []) {
      for (const annotation of block?.annotations ?? []) {
        if (annotation?.type === 'place_citation' && annotation.name && annotation.url) {
          const key = `${annotation.name}|${annotation.url}`;
          if (!seen.has(key)) {
            seen.add(key);
            citations.push({ name: annotation.name, url: annotation.url });
          }
        }
      }
    }
  }

  return { summary: summary.trim(), citations };
}
