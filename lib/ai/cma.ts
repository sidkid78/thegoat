import { ai, GEMINI_MODELS } from './client';
import { createClient } from '@/lib/supabase/server';

export interface CmaReportResult {
  estimatedValuation: number;
  valuationRangeLow: number;
  valuationRangeHigh: number;
  confidenceScore: number; // 0.0 - 1.0
  pricePerSqFtEstimate: number;
  estimatedMonthlyRentalIncome: number;
  marketTrendAnalysis: {
    neighborhoodVelocity: string;
    supplyDemandBalance: string;
    projected12MonthAppreciation: string;
  };
  valuationMethodologyAndReasoning: string[];
  keyAdjustments: Array<{
    feature: string;
    valueImpactUsd: number;
    reasoning: string;
  }>;
  comparablePropertySummaries: Array<{
    address: string;
    saleOrListPrice: number;
    similarityScore: number;
    keyDifferences: string;
  }>;
}

/**
 * TypeBox/JSON Schema specification for Gemini Structured Output
 */
const cmaOutputSchema = {
  type: 'object',
  properties: {
    estimatedValuation: { type: 'number', description: 'Estimated fair market value in USD.' },
    valuationRangeLow: { type: 'number', description: 'Low boundary valuation.' },
    valuationRangeHigh: { type: 'number', description: 'High boundary valuation.' },
    confidenceScore: { type: 'number', description: 'Confidence score between 0.0 and 1.0.' },
    pricePerSqFtEstimate: { type: 'number', description: 'Estimated price per square foot.' },
    estimatedMonthlyRentalIncome: { type: 'number', description: 'Estimated monthly rental income in USD.' },
    marketTrendAnalysis: {
      type: 'object',
      properties: {
        neighborhoodVelocity: { type: 'string' },
        supplyDemandBalance: { type: 'string' },
        projected12MonthAppreciation: { type: 'string' },
      },
      required: ['neighborhoodVelocity', 'supplyDemandBalance', 'projected12MonthAppreciation'],
    },
    valuationMethodologyAndReasoning: {
      type: 'array',
      items: { type: 'string' },
    },
    keyAdjustments: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          feature: { type: 'string' },
          valueImpactUsd: { type: 'number' },
          reasoning: { type: 'string' },
        },
        required: ['feature', 'valueImpactUsd', 'reasoning'],
      },
    },
    comparablePropertySummaries: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          address: { type: 'string' },
          saleOrListPrice: { type: 'number' },
          similarityScore: { type: 'number' },
          keyDifferences: { type: 'string' },
        },
        required: ['address', 'saleOrListPrice', 'similarityScore', 'keyDifferences'],
      },
    },
  },
  required: [
    'estimatedValuation',
    'valuationRangeLow',
    'valuationRangeHigh',
    'confidenceScore',
    'pricePerSqFtEstimate',
    'estimatedMonthlyRentalIncome',
    'marketTrendAnalysis',
    'valuationMethodologyAndReasoning',
    'keyAdjustments',
    'comparablePropertySummaries',
  ],
};

/**
 * Triggers the AI Valuation Engine using gemini-3-pro-preview
 * Utilizes High Thinking Budget for deep financial reasoning and structured JSON output
 */
export async function generateCmaReport(propertyId: number, userId: string): Promise<{
  cmaReportId: number;
  report: CmaReportResult;
}> {
  const supabase = await createClient();

  // 1. Fetch Subject Property Details
  const { data: subjectProperty, error: propError } = await supabase
    .from('properties')
    .select('*')
    .eq('id', propertyId)
    .single();

  if (propError || !subjectProperty) {
    throw new Error(`Property with ID ${propertyId} not found.`);
  }

  // 2. Fetch Nearby Comparables from Database
  const { data: comps } = await supabase
    .from('properties')
    .select('*')
    .eq('city', subjectProperty.city)
    .neq('id', propertyId)
    .limit(5);

  const prompt = `
Perform a rigorous Comparative Market Analysis (CMA) and valuation for the following subject property:

SUBJECT PROPERTY DETAILS:
Address: ${subjectProperty.address}, ${subjectProperty.city}, ${subjectProperty.state} ${subjectProperty.zip_code}
List Price: $${subjectProperty.price}
Bedrooms: ${subjectProperty.bedrooms}
Bathrooms: ${subjectProperty.bathrooms}
Square Feet: ${subjectProperty.square_feet || 'N/A'}
Property Type: ${subjectProperty.property_type}
Description: ${subjectProperty.description}
Features: ${JSON.stringify(subjectProperty.features)}

RELEVANT NEIGHBORHOOD COMPARABLES:
${JSON.stringify(comps || [], null, 2)}

Instructions:
1. Analyze physical adjustments (e.g. square footage differences, pool presence, EV charging, solar panels, bedroom/bath counts).
2. Calculate estimated fair market value, lower/upper range, monthly rental yield, and per-sqft metrics.
3. Detail the key value adjustment line items.
4. Output strict JSON matching the provided schema.
`;

  // 3. Call Gemini Pro with deep reasoning effort.
  // Interactions API shape: `thinking_level` lives under generation_config, and
  // `response_format` is a TOP-LEVEL parameter (not nested inside it). Nesting
  // it, or passing the older `thinking_config.thinking_budget`, is rejected with
  // "400 Unknown parameter 'thinking_config' at 'generation_config'".
  const interaction = await ai.interactions.create({
    model: GEMINI_MODELS.REASONING_PRO,
    input: prompt,
    generation_config: {
      thinking_level: 'high',
    },
    response_format: {
      type: 'text',
      mime_type: 'application/json',
      schema: cmaOutputSchema,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  // output_text collects the trailing model_output text for us.
  const responseText =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (interaction as any).output_text ?? (interaction.steps?.at(-1) as any)?.content?.[0]?.text;

  if (!responseText) {
    throw new Error('CMA Valuation generation returned an empty response.');
  }

  const parsedReport: CmaReportResult = JSON.parse(responseText);

  // 4. Save Generated CMA to Supabase Database
  const { data: savedCma, error: saveError } = await supabase
    .from('cma_reports')
    .insert({
      property_id: propertyId,
      user_id: userId,
      estimated_valuation: parsedReport.estimatedValuation,
      valuation_range_low: parsedReport.valuationRangeLow,
      valuation_range_high: parsedReport.valuationRangeHigh,
      comparable_property_ids: comps?.map((c) => c.id) || [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      report_data: parsedReport as any,
    })
    .select('id')
    .single();

  if (saveError) {
    console.error('Error saving CMA report to database:', saveError);
    throw new Error(`Failed to persist CMA report: ${saveError.message}`);
  }

  return {
    cmaReportId: savedCma.id,
    report: parsedReport,
  };
}