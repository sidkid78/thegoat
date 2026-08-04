
import { ai, GEMINI_MODELS } from './client';
import {
  ALL_AGENT_TOOLS,
  executeSearchProperties,
  executeScheduleViewing,
} from './tools';

export const DWELLINGLY_SYSTEM_INSTRUCTION = `
You are Dwellingly AI (NexHomeAgent), an elite, highly intelligent real estate advisor and concierge.
Your primary mission is to assist buyers and sellers through every stage of home purchasing, listing, valuation, and offer coordination.

Guidelines:
1. Speak with professional warm authority, deep domain expertise, and clarity.
2. Use the provided search tools when users ask for property recommendations or search queries.
3. When property listings are returned from search tools, summarize key highlights (price, location, beds/baths, square footage, unique features) and provide direct recommendations.
4. Encourage viewing appointments or CMA valuation requests when appropriate.
5. Keep answers concise, visually structured with Markdown bullet points, and actionable.
6. For questions about a neighborhood, nearby amenities, walkability, schools, or "what's around here", use the Google Maps grounding tool rather than guessing — it has real, current place data.
`;

/** Optional real-world location context so Maps grounding can bias toward the
 * property the user is actually looking at, e.g. from the property detail page. */
export interface PropertyLocationContext {
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  latitude?: number | null;
  longitude?: number | null;
}

function buildTools(propertyContext?: PropertyLocationContext) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapsTool: any = { type: 'google_maps' };
  if (propertyContext?.latitude != null && propertyContext?.longitude != null) {
    mapsTool.latitude = propertyContext.latitude;
    mapsTool.longitude = propertyContext.longitude;
  }
  return [...ALL_AGENT_TOOLS, mapsTool];
}

function buildSystemInstruction(propertyContext?: PropertyLocationContext) {
  if (!propertyContext?.address) return DWELLINGLY_SYSTEM_INSTRUCTION;
  const location = [propertyContext.address, propertyContext.city, propertyContext.state, propertyContext.zipCode]
    .filter(Boolean)
    .join(', ');
  return `${DWELLINGLY_SYSTEM_INSTRUCTION}\n\nThe user is currently viewing this property: ${location}. Ground neighborhood, amenity, and walkability questions near this address.`;
}

/**
 * Pulls `place_citation` annotations (name + Maps source URL) off the
 * `model_output` steps of a completed interaction, deduped. Maps grounding
 * attaches these as content-block annotations rather than a separate step,
 * so this only surfaces after fetching the full interaction — never on the
 * streamed deltas themselves.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractCitations(interaction: any): { name: string; url: string }[] {
  const steps = interaction?.steps || [];
  const seen = new Set<string>();
  const citations: { name: string; url: string }[] = [];

  for (const step of steps) {
    if (step?.type !== 'model_output') continue;
    for (const block of step.content || []) {
      for (const annotation of block?.annotations || []) {
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

  return citations;
}

/**
 * Pulls the text out of a streamed Interactions API event.
 *
 * Events from the SDK carry `event_type`, not `type`, and text arrives as a
 * delta with `delta.type === 'text'`. Other deltas (e.g. thought_signature)
 * have no text and must be skipped. Both stream loops below go through this so
 * they cannot drift apart.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractTextDelta(event: any): string | null {
  const delta = event?.delta;
  if (delta?.type === 'text' && typeof delta.text === 'string') {
    return delta.text;
  }
  if (typeof event?.text === 'string') {
    return event.text;
  }
  return null;
}

/**
 * Events streamed to the client. Declared as a discriminated union so consumers
 * narrowing on `type` get the right payload fields.
 */
export type AgentChatEvent =
  | { type: 'interaction_id'; content: string }
  | { type: 'token'; content: string }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | { type: 'tool_executed'; tool: string; args: any; result: any }
  | { type: 'citations'; content: { name: string; url: string }[] };

/**
 * Handles multi-turn streaming AI Chat with turn management and automated function calling loop
 */
export async function* streamAgentChat(params: {
  userId: string;
  interactionId?: string;
  newMessage: string;
  propertyContext?: PropertyLocationContext;
}): AsyncGenerator<AgentChatEvent> {
  const { userId, interactionId, newMessage, propertyContext } = params;
  const tools = buildTools(propertyContext);
  const systemInstruction = buildSystemInstruction(propertyContext);

  // 1. Initial Call to Gemini Interactions API
  const stream = await ai.interactions.create({
    model: GEMINI_MODELS.CHAT_FLASH,
    input: newMessage,
    previous_interaction_id: interactionId,
    system_instruction: systemInstruction,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tools: tools as any,
    stream: true,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let completedInteraction: any = null;
  let currentInteractionId = interactionId;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for await (const event of stream as any) {
    console.log('STREAM EVENT:', JSON.stringify(event));
    if (event.interaction?.id) {
      const id: string = event.interaction.id;
      currentInteractionId = id;
      yield { type: 'interaction_id', content: id };
    }
    
    const textChunk = extractTextDelta(event);
    if (textChunk) {
      yield { type: 'token', content: textChunk };
    }

    if (event.type === 'interaction.complete' || event.interaction?.status) {
      completedInteraction = event.interaction || event;
    }
  }

  // 2. Function Call Resolution Loop
  if (completedInteraction?.status === 'requires_action' && currentInteractionId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fullInteraction: any = await ai.interactions.get(currentInteractionId);

    // Maps grounding (a built-in tool) can resolve in the same turn as a
    // pending custom function call, so check for citations here too.
    const preCitations = extractCitations(fullInteraction);
    if (preCitations.length) {
      yield { type: 'citations', content: preCitations };
    }

    const steps = fullInteraction.steps || [];
    const functionCalls = steps.filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (s: any) => s.type === 'function_call' || s.name
    );

    const functionResults = [];

    for (const callItem of functionCalls) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const call = callItem as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let toolResult: any;

      if (call.name === 'searchProperties') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        toolResult = await executeSearchProperties(call.arguments as any);
      } else if (call.name === 'schedulePropertyViewing') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        toolResult = await executeScheduleViewing(userId, call.arguments as any);
      } else {
        toolResult = { error: `Unknown tool function: ${call.name}` };
      }

      // Tell frontend to render the properties UI
      yield {
        type: 'tool_executed',
        tool: call.name,
        args: call.arguments,
        result: toolResult,
      };

      functionResults.push({
        type: 'function_result',
        call_id: call.id,
        name: call.name,
        result: [
          { type: 'text', text: JSON.stringify(toolResult) }
        ]
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
    }

    // 3. Re-prompt Gemini with function output to stream final user response
    if (functionResults.length > 0) {
      const followUpStream = await ai.interactions.create({
        model: GEMINI_MODELS.CHAT_FLASH,
        input: functionResults,
        previous_interaction_id: currentInteractionId,
        system_instruction: systemInstruction,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tools: tools as any,
        stream: true,
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for await (const chunk of followUpStream as any) {
        if (chunk.interaction?.id) currentInteractionId = chunk.interaction.id;
        const textChunk = extractTextDelta(chunk);
        if (textChunk) {
          yield { type: 'token', content: textChunk };
        }
      }

      if (currentInteractionId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const finalInteraction: any = await ai.interactions.get(currentInteractionId);
        const finalCitations = extractCitations(finalInteraction);
        if (finalCitations.length) {
          yield { type: 'citations', content: finalCitations };
        }
      }
    }
  } else if (currentInteractionId) {
    // No function call needed — Maps grounding may still have resolved on
    // its own in this turn, so check the completed interaction for citations.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fullInteraction: any = await ai.interactions.get(currentInteractionId);
    const citations = extractCitations(fullInteraction);
    if (citations.length) {
      yield { type: 'citations', content: citations };
    }
  }
}