import { ai, GEMINI_MODELS } from './client';

export interface NegotiationInput {
  propertyAddress: string;
  zipCode: string;
  listPrice: number;
  offerAmount: number;
  earnestMoney: number | null;
  financingType: string | null;
  proposedClosingDate: string | null;
  contingencies: string[];
  /** Most recent CMA valuation, when one exists. */
  estimatedValuation: number | null;
  /** Recent thread messages, oldest first, as "Role: body". */
  recentMessages: string[];
  competingOfferAmounts: number[];
}

export interface NegotiationStrategy {
  /** Two or three sentences of reasoning, in the seller's terms. */
  rationale: string;
  /** Counter price in USD. May equal the offer if holding firm is best. */
  counterAmount: number;
  /** Seller-funded credit in USD. 0 when none is warranted. */
  concession: number;
  /** Short label for what the concession covers, e.g. "roof repair credit". */
  concessionReason: string;
}

const strategySchema = {
  type: 'object',
  properties: {
    rationale: {
      type: 'string',
      description:
        'Two or three sentences explaining the recommended counter, weighing net proceeds against the risk the buyer walks.',
    },
    counterAmount: {
      type: 'number',
      description: 'Recommended counter price in USD.',
    },
    concession: {
      type: 'number',
      description: 'Recommended seller-funded credit in USD. Use 0 if none is warranted.',
    },
    concessionReason: {
      type: 'string',
      description: 'Short label for what the credit covers. Empty string when concession is 0.',
    },
  },
  required: ['rationale', 'counterAmount', 'concession', 'concessionReason'],
};

/**
 * Recommends counter-offer terms for the seller on a live negotiation.
 *
 * Grounded strictly in the deal's own numbers -- the offer, the listing, the
 * latest CMA and what the two parties have actually said to each other. It is
 * told not to invent market statistics, because nothing in this app can source
 * them and a fabricated "market velocity" figure reads exactly like a real one.
 */
export async function generateNegotiationStrategy(
  input: NegotiationInput
): Promise<NegotiationStrategy> {
  const prompt = `
You are advising a home seller on how to respond to a live offer.

LISTING: ${input.propertyAddress} (${input.zipCode})
LIST PRICE: $${input.listPrice.toLocaleString()}
${input.estimatedValuation ? `AI VALUATION: $${input.estimatedValuation.toLocaleString()}` : 'AI VALUATION: none generated yet'}

THE OFFER ON THE TABLE:
- Amount: $${input.offerAmount.toLocaleString()}
- Earnest money: ${input.earnestMoney ? `$${input.earnestMoney.toLocaleString()}` : 'not specified'}
- Financing: ${input.financingType ?? 'not specified'}
- Proposed closing: ${input.proposedClosingDate ?? 'not specified'}
- Contingencies the buyer kept: ${input.contingencies.length ? input.contingencies.join(', ') : 'none — all waived'}

COMPETING OFFERS ON THIS LISTING: ${
    input.competingOfferAmounts.length
      ? input.competingOfferAmounts.map((a) => `$${a.toLocaleString()}`).join(', ')
      : 'none'
  }

WHAT THE TWO PARTIES HAVE SAID SO FAR:
${input.recentMessages.length ? input.recentMessages.join('\n') : '(no messages yet)'}

Recommend counter terms. Consider:
- The gap between the offer and both list price and the AI valuation.
- Whether a seller-funded credit closes the deal more cheaply than a price cut
  (a credit is a one-time cost; a lower price also lowers the appraisal anchor).
- The buyer's leverage: waived contingencies and strong financing mean they can
  credibly walk, and a competing offer means the seller can.
- Anything specific the parties raised in the messages above.

Base every claim on the figures given. Do NOT invent market velocity, days-on-market,
buyer-interest levels, or neighbourhood statistics -- you have not been given them.
Output strict JSON matching the schema.
`;

  const interaction = await ai.interactions.create({
    model: GEMINI_MODELS.REASONING_PRO,
    input: prompt,
    generation_config: { thinking_level: 'medium' },
    response_format: {
      type: 'text',
      mime_type: 'application/json',
      schema: strategySchema,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  const responseText =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (interaction as any).output_text ?? (interaction.steps?.at(-1) as any)?.content?.[0]?.text;

  if (!responseText) {
    throw new Error('Negotiation strategy returned an empty response.');
  }

  return JSON.parse(responseText) as NegotiationStrategy;
}
