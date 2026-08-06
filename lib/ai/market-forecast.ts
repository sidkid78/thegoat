import { ai, GEMINI_MODELS } from './client';
import type { Forecast } from '@/lib/market/forecast';

export interface MarketAnalysisInput {
  zipCode: string;
  city: string;
  state: string;
  /** The listing's asking price, for context against the ZIP median. */
  listPrice: number;
  forecast: Forecast;
  /** Recent monthly history, oldest first, for shape and turning points. */
  recentMonths: { period: string; medianSalePrice: number; homesSold: number | null; medianDom: number | null }[];
}

export interface MarketAnalysis {
  /** Plain-language read of where the ZIP's market has been and is heading. */
  summary: string;
  /** What could push the market away from the projection, most material first. */
  risks: string[];
  /** How much weight the projection deserves, given trend strength and error. */
  confidence: 'low' | 'moderate' | 'high';
  confidenceReason: string;
}

const analysisSchema = {
  type: 'object',
  properties: {
    summary: {
      type: 'string',
      description:
        'Three or four sentences describing the trajectory of this ZIP code median and what the projection implies. Reference specific figures from the data provided.',
    },
    risks: {
      type: 'array',
      items: { type: 'string' },
      description:
        'Two to four concrete factors that could move the market away from the projection, most material first. Each one sentence.',
    },
    confidence: {
      type: 'string',
      enum: ['low', 'moderate', 'high'],
      description:
        'How much weight the 12-month projection deserves, judged from r-squared and the backtest error.',
    },
    confidenceReason: {
      type: 'string',
      description: 'One sentence citing the r-squared and median absolute error behind the confidence rating.',
    },
  },
  required: ['summary', 'risks', 'confidence', 'confidenceReason'],
};

/**
 * Narrates a forecast that has already been computed. Gemini interprets; it
 * never produces the numbers -- those come from `forecastPrices()`, which is
 * plain, testable regression. Asking a model to predict a price directly gets
 * you a confident figure with nothing behind it.
 *
 * The prompt is explicit that this is ZIP-level and that no per-property sale
 * history exists, because that is exactly the boundary a model will otherwise
 * cross: invent a prior sale, a school rating, a rate forecast, an inventory
 * number. Everything it is allowed to cite is in the payload.
 */
export async function generateMarketAnalysis(input: MarketAnalysisInput): Promise<MarketAnalysis> {
  const { forecast: f } = input;
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
  const usd = (v: number) => `$${Math.round(v).toLocaleString()}`;

  const history = input.recentMonths
    .map(
      (m) =>
        `  ${m.period}: median ${usd(m.medianSalePrice)}` +
        (m.homesSold != null ? `, ${m.homesSold} sold` : '') +
        (m.medianDom != null ? `, ${m.medianDom} days on market` : '')
    )
    .join('\n');

  const prompt = `You are a housing market analyst. Interpret the statistics below for a prospective buyer looking at a listing in ZIP ${input.zipCode} (${input.city}, ${input.state}).

LISTING ASKING PRICE: ${usd(input.listPrice)}

ZIP-LEVEL MARKET STATISTICS (Redfin Data Center, all residential):
- Latest monthly median sale price (${f.latestPeriod}): ${usd(f.latestPrice)}
- Trailing 3-month average median: ${usd(f.anchorPrice)}
- Fitted trend over the last ${f.windowMonths} months: ${pct(f.annualizedTrend)} per year
- Trend fit quality (r-squared): ${f.rSquared.toFixed(3)}
- 12-month projection (${f.projectedPeriod}): ${usd(f.projectedPrice)}
- Projection range: ${usd(f.lowPrice)} to ${usd(f.highPrice)}
${
  f.backtest
    ? `- Backtest of this exact method on this ZIP's own history: ${f.backtest.samples} predictions, median absolute error ${f.backtest.medianAbsPctError.toFixed(1)}%, 10th-90th percentile error ${f.backtest.p10PctError.toFixed(1)}% to ${f.backtest.p90PctError.toFixed(1)}%`
    : '- Not enough history to backtest this projection'
}

RECENT MONTHLY HISTORY (oldest first):
${history}

RULES:
- Base every claim on the figures above. They are all you have.
- Quote figures exactly as given. Do not round, average, or merge two months into one number. (A first pass at this stated a month's median as $900,000 when the table said $890,000 — that is the failure mode to avoid.)
- Do NOT invent mortgage rates, employment data, migration figures, school ratings, construction pipelines, inventory counts, or any statistic not listed. If a risk depends on something you were not given, describe it qualitatively without attaching numbers.
- This is ZIP-level market data. It describes the area, NOT this specific home. There is no sale history for this property. Never imply otherwise.
- An r-squared near zero means the trend line explains almost nothing and the projection is barely better than assuming flat. Say so plainly when that is the case.
- The projection is a trend extrapolation. It cannot anticipate a rate shock, a policy change, or a local supply shift. Treat it accordingly.
- Do not give purchase advice or tell the reader what to do. Describe the market; leave the decision to them.
- Write for a general reader. No jargon without a plain-language gloss.`;

  const interaction = await ai.interactions.create({
    model: GEMINI_MODELS.REASONING_PRO,
    input: prompt,
    // 'medium' rather than 'low': at low effort the model paraphrased figures
    // from the table instead of reading them off exactly.
    generation_config: { thinking_level: 'medium' },
    response_format: {
      type: 'text',
      mime_type: 'application/json',
      schema: analysisSchema,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  const responseText =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (interaction as any).output_text ?? (interaction.steps?.at(-1) as any)?.content?.[0]?.text;

  if (!responseText) {
    throw new Error('Market analysis returned an empty response.');
  }

  return JSON.parse(responseText) as MarketAnalysis;
}
