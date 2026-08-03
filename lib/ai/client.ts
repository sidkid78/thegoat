import { GoogleGenAI } from '@google/genai';

if (!process.env.GEMINI_API_KEY) {
  throw new Error('Missing GEMINI_API_KEY in environment variables.');
}

/**
 * Singleton GoogleGenAI Client instance
 * Configured using the official @google/genai SDK
 */
export const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

/**
 * Standardized Model Identifiers across Dwellingly.ai
 */
export const GEMINI_MODELS = {
  // Primary conversational & fast agent model
  CHAT_FLASH: 'gemini-3.6-flash',
  // Deep reasoning model for complex CMAs, legal offer checks, and financial calculations
  REASONING_PRO: 'gemini-3.1-pro-preview',
  // Multimodal image generation and virtual staging editing model
  IMAGE_GEN: 'gemini-3.1-flash-image',
  // High fidelity visual perception and image inspection model
  VISION_PRO: 'gemini-3.6-flash',
  // Standard text embedding model for pgvector semantic search (768 dimensions)
  EMBEDDINGS: 'gemini-embedding-001',
} as const;

export type GeminiModelKey = keyof typeof GEMINI_MODELS;

export async function generateEmbedding(text: string): Promise<number[]> {
  const startTime = Date.now();
  const textPreview = text.length > 80 ? `${text.slice(0, 80)}...` : text;

  console.log(`[Gemini Embeddings] Generating embedding using model '${GEMINI_MODELS.EMBEDDINGS}' | Length: ${text.length} chars | Preview: "${textPreview}"`);

  try {
    const response = await ai.models.embedContent({
      model: GEMINI_MODELS.EMBEDDINGS,
      contents: text,
      config: {
        outputDimensionality: 768,
      },
    });

    const values = response.embeddings?.[0]?.values;

    if (!values || values.length === 0) {
      const errorMsg = 'Failed to extract embedding values from Gemini API response';
      console.error(`[Gemini Embeddings ERROR] ${errorMsg} | Duration: ${Date.now() - startTime}ms`);
      throw new Error(errorMsg);
    }

    const durationMs = Date.now() - startTime;
    console.log(`[Gemini Embeddings SUCCESS] Successfully generated ${values.length}-dim vector in ${durationMs}ms`);

    return values;
  } catch (error: unknown) {
    const durationMs = Date.now() - startTime;
    const errorDetails = error instanceof Error ? error.stack || error.message : String(error);

    console.error(
      `[Gemini Embeddings FAILED] Model: ${GEMINI_MODELS.EMBEDDINGS} | Duration: ${durationMs}ms | Preview: "${textPreview}"\nError: ${errorDetails}`
    );

    throw error;
  }
}