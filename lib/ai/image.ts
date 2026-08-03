import { ai, GEMINI_MODELS } from './client';

export interface VirtualStagingOptions {
  roomType: 'living_room' | 'bedroom' | 'kitchen' | 'patio' | 'dining';
  designStyle: 'modern_minimalist' | 'scandinavian' | 'luxury_contemporary' | 'coastal_boho' | 'industrial';
  additionalInstructions?: string;
}

export interface ImageAnalysisResult {
  detectedRoomType: string;
  perceivedCondition: string;
  stagingSuggestions: string[];
  keyFeaturesIdentified: string[];
  estimatedRenovationRoiTips: string[];
}

/** Schema for the structured analysis response. */
const imageAnalysisSchema = {
  type: 'object',
  properties: {
    detectedRoomType: { type: 'string', description: 'e.g. Living Room' },
    perceivedCondition: { type: 'string', description: 'e.g. Excellent / Needs Cosmetic Updates' },
    stagingSuggestions: { type: 'array', items: { type: 'string' } },
    keyFeaturesIdentified: { type: 'array', items: { type: 'string' } },
    estimatedRenovationRoiTips: { type: 'array', items: { type: 'string' } },
  },
  required: [
    'detectedRoomType',
    'perceivedCondition',
    'stagingSuggestions',
    'keyFeaturesIdentified',
    'estimatedRenovationRoiTips',
  ],
};

/**
 * Analyzes an uploaded property image for virtual staging recommendations and quality assessment
 */
export async function analyzePropertyImage(imageBase64: string, mimeType: string = 'image/jpeg'): Promise<ImageAnalysisResult> {
  const prompt = `
Analyze this real estate property photo in detail and provide structural recommendations for staging and enhancement.

Return a valid JSON object with the following structure:
{
  "detectedRoomType": "e.g. Living Room",
  "perceivedCondition": "e.g. Excellent / Needs Cosmetic Updates",
  "stagingSuggestions": ["suggestion 1", "suggestion 2"],
  "keyFeaturesIdentified": ["hardwood floors", "natural light"],
  "estimatedRenovationRoiTips": ["tip 1", "tip 2"]
}
`;

  // `response_format` is a TOP-LEVEL parameter on the Interactions API; nesting
  // it inside generation_config (or using the older `json_object` type) is
  // rejected with a 400.
  const interaction = await ai.interactions.create({
    model: GEMINI_MODELS.VISION_PRO,
    input: [
      { type: 'image', data: imageBase64, mime_type: mimeType },
      { type: 'text', text: prompt },
    ],
    response_format: {
      type: 'text',
      mime_type: 'application/json',
      schema: imageAnalysisSchema,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  const responseText =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (interaction as any).output_text ?? (interaction.steps?.at(-1) as any)?.content?.[0]?.text;

  if (!responseText) {
    throw new Error('Image analysis failed to generate text response.');
  }

  return JSON.parse(responseText) as ImageAnalysisResult;
}

/**
 * Generates a virtually staged property image using gemini-2.5-flash-image
 */
export async function generateVirtualStagingImage(params: {
  originalImageBase64: string;
  mimeType?: string;
  options: VirtualStagingOptions;
}): Promise<{ imageBase64: string; mimeType: string }> {
  const { originalImageBase64, mimeType = 'image/jpeg', options } = params;

  const prompt = `
Professional high-end architectural photography of a ${options.roomType.replace('_', ' ')}.
Staged in a stunning ${options.designStyle.replace('_', ' ')} interior design style.
Include modern high-end furniture, tasteful decor, warm ambient lighting, natural plants, and wall art.
Maintain the architectural layout, windows, doors, and structural walls of the original room.
${options.additionalInstructions || ''}
Photo quality: 8K resolution, photorealistic, ultra-detailed interior design digest standard.
`;

  const interaction = await ai.interactions.create({
    model: GEMINI_MODELS.IMAGE_GEN,
    input: [
      { type: 'image', data: originalImageBase64, mime_type: mimeType },
      { type: 'text', text: prompt },
    ],
    response_format: {
      type: 'image',
      mime_type: 'image/jpeg',
      aspect_ratio: '4:3',
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  // `output_image` is the documented accessor for the generated image.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const generated = (interaction as any).output_image
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ?? (interaction.steps?.at(-1) as any)?.content?.find((c: any) => c?.type === 'image');

  if (!generated?.data) {
    throw new Error('Failed to generate virtually staged image from model.');
  }

  return {
    imageBase64: generated.data,
    mimeType: generated.mime_type || 'image/jpeg',
  };
}