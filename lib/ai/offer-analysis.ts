import { ai, GEMINI_MODELS } from './client';

export interface OfferAnalysisInput {
  listPrice: number;
  propertyAddress: string;
  offers: Array<{
    id: number;
    label: string;
    offerAmount: number;
    earnestMoney: number | null;
    financingType: string | null;
    downPayment: number | null;
    proposedClosingDate: string | null;
    contingencies: string[];
  }>;
}

export interface OfferAnalysisResult {
  /** `offers[].id` of the recommended offer. */
  topPickOfferId: number;
  /** Why this one wins, in the seller's terms. */
  rationale: string;
  /** One short note per offer, keyed by offer id. */
  notes: Array<{ offerId: number; strength: string; risk: string }>;
}

const offerAnalysisSchema = {
  type: 'object',
  properties: {
    topPickOfferId: {
      type: 'integer',
      description: 'The id of the single strongest offer for the seller.',
    },
    rationale: {
      type: 'string',
      description:
        'Two or three sentences explaining why the top pick is strongest, weighing net proceeds against certainty of close.',
    },
    notes: {
      type: 'array',
      description: 'Exactly one entry per offer supplied, in the same order.',
      items: {
        type: 'object',
        properties: {
          offerId: { type: 'integer' },
          strength: { type: 'string', description: 'The single biggest advantage of this offer. Under 12 words.' },
          risk: { type: 'string', description: 'The single biggest risk of this offer. Under 12 words.' },
        },
        required: ['offerId', 'strength', 'risk'],
      },
    },
  },
  required: ['topPickOfferId', 'rationale', 'notes'],
};

/**
 * Ranks live offers on a listing for the seller. Deliberately on-demand rather
 * than run on page load -- it's a paid reasoning call, and a seller re-reads
 * this page far more often than the offer set changes.
 */
export async function analyzeOffers(input: OfferAnalysisInput): Promise<OfferAnalysisResult> {
  const prompt = `
You are advising a home seller on which of several competing offers to accept.

PROPERTY: ${input.propertyAddress}
LIST PRICE: $${input.listPrice.toLocaleString()}
TODAY: ${new Date().toISOString().slice(0, 10)}

OFFERS:
${JSON.stringify(input.offers, null, 2)}

Weigh net proceeds against certainty and speed of close. Specifically consider:
- Price relative to list, but do not treat the highest number as automatically best.
- Financing strength: cash closes fastest and cannot fall through on loan denial;
  conventional with a large down payment is stronger than FHA/VA with a small one.
- Each contingency the buyer keeps is an exit they can walk through; waived
  contingencies raise certainty for the seller.
- Earnest money size signals commitment and is the seller's remedy on default.
- A nearer closing date reduces the window for anything to go wrong.

Pick exactly one top offer by its id. Return one note per offer, in the order given.
Output strict JSON matching the schema.
`;

  const interaction = await ai.interactions.create({
    model: GEMINI_MODELS.REASONING_PRO,
    input: prompt,
    generation_config: {
      thinking_level: 'medium',
    },
    response_format: {
      type: 'text',
      mime_type: 'application/json',
      schema: offerAnalysisSchema,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  const responseText =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (interaction as any).output_text ?? (interaction.steps?.at(-1) as any)?.content?.[0]?.text;

  if (!responseText) {
    throw new Error('Offer analysis returned an empty response.');
  }

  return JSON.parse(responseText) as OfferAnalysisResult;
}
