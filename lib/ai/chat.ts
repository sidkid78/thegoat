
import { ai, GEMINI_MODELS } from './client';
import {
  ALL_AGENT_TOOLS,
  executeSearchProperties,
  executeGetNeighborhoodStats,
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
`;

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
  | { type: 'tool_executed'; tool: string; args: any; result: any };

/**
 * Handles multi-turn streaming AI Chat with turn management and automated function calling loop
 */
export async function* streamAgentChat(params: {
  userId: string;
  interactionId?: string;
  newMessage: string;
}): AsyncGenerator<AgentChatEvent> {
  const { userId, interactionId, newMessage } = params;

  // 1. Initial Call to Gemini Interactions API
  const stream = await ai.interactions.create({
    model: GEMINI_MODELS.CHAT_FLASH,
    input: newMessage,
    previous_interaction_id: interactionId,
    system_instruction: DWELLINGLY_SYSTEM_INSTRUCTION,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tools: ALL_AGENT_TOOLS as any,
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
      } else if (call.name === 'getNeighborhoodStats') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        toolResult = await executeGetNeighborhoodStats(call.arguments as any);
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
        system_instruction: DWELLINGLY_SYSTEM_INSTRUCTION,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tools: ALL_AGENT_TOOLS as any,
        stream: true,
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for await (const chunk of followUpStream as any) {
        const textChunk = extractTextDelta(chunk);
        if (textChunk) {
          yield { type: 'token', content: textChunk };
        }
      }
    }
  }
}