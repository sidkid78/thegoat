import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8');
  for (const line of envConfig.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const equalsIndex = trimmed.indexOf('=');
      if (equalsIndex !== -1) {
        const key = trimmed.substring(0, equalsIndex).trim();
        let value = trimmed.substring(equalsIndex + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        process.env[key] = value;
      }
    }
  }
}

import { streamAgentChat } from '../lib/ai/chat';

async function testFullAiChat() {
  console.log('🤖 Sending prompt to Dwellingly AI Chat Agent...');
  const userPrompt = 'Show me spacious 3 bedroom homes with garage and pool features.';
  console.log(`User Input: "${userPrompt}"\n`);

  try {
    const generator = streamAgentChat({
      userId: 'test-user-123',
      newMessage: userPrompt,
    });

    for await (const chunk of generator) {
      if (chunk.type === 'token') {
        process.stdout.write(chunk.content);
      } else if (chunk.type === 'tool_executed') {
        console.log(`\n\n🛠️  [TOOL EXECUTED] Function: ${chunk.tool} | Args:`, JSON.stringify(chunk.args));
        console.log(`📊 Result: Found ${chunk.result?.resultCount || 0} listings via pgvector search.\n`);
      } else if (chunk.type === 'interaction_id') {
        console.log(`[Interaction ID]: ${chunk.content}`);
      }
    }
    console.log('\n\n✅ AI Chat Turn Complete!');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.stack || err.message : String(err);
    console.error('AI Chat Error:', msg);
  }
}

testFullAiChat();
