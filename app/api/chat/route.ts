import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { streamAgentChat } from '@/lib/ai/chat';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const userId = user?.id || 'guest';

    const body = await req.json();
    const { interactionId, newMessage } = body as {
      interactionId?: string;
      newMessage: string;
    };

    if (!newMessage || typeof newMessage !== 'string') {
      return NextResponse.json({ error: 'Invalid or missing newMessage' }, { status: 400 });
    }

    const encoder = new TextEncoder();

    // Create a ReadableStream to push Gemini assistant SSE tokens
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const chatGenerator = streamAgentChat({
            userId: userId,
            interactionId,
            newMessage,
          });

          for await (const chunk of chatGenerator) {
            const dataPayload = `data: ${JSON.stringify(chunk)}\n\n`;
            controller.enqueue(encoder.encode(dataPayload));
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error: unknown) {
          console.error('Chat Streaming Error:', error);
          const errorMessage = error instanceof Error ? error.message : String(error);
          const errorPayload = `data: ${JSON.stringify({ type: 'error', content: errorMessage })}\n\n`;
          controller.enqueue(encoder.encode(errorPayload));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (err: unknown) {
    console.error('API /api/chat error:', err);
    const errorMessage = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}