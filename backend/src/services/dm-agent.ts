import { LlmAgent, InMemoryRunner, isFinalResponse } from '@google/adk';
import { randomUUID } from 'crypto';

const APP_NAME = 'codecrawler';

const dungeonMasterAgent = new LlmAgent({
  name: 'dungeon_master',
  model: 'gemini-2.5-flash',
  description: 'AI Dungeon Master for tabletop RPG campaigns',
  instruction: `You are an experienced and creative Dungeon Master for a tabletop RPG campaign.
Your role is to:
- Narrate the story vividly and immersively using second-person narrative ("You see...", "Before you...")
- React to player actions and advance the story based on what they say
- Incorporate the campaign's theme and adapt your tone to the difficulty level
- Keep responses concise but evocative (2-4 sentences typically)
- Casual tone for Easy difficulty, dramatic for Medium, gritty and dangerous for Hard
- Never break character as the Dungeon Master
- If a dice roll is mentioned, incorporate the result naturally into the narrative`,
});

const runner = new InMemoryRunner({
  agent: dungeonMasterAgent,
  appName: APP_NAME,
});

export interface DmContext {
  campaignName: string;
  theme: string;
  difficulty: string;
  recentMessages: Array<{ display_name: string; content: string; is_dm: boolean }>;
  userMessage: string;
}

export async function askDungeonMaster(ctx: DmContext): Promise<string> {
  if (!process.env['GEMINI_API_KEY']) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }

  const historyLines = ctx.recentMessages
    .slice(-10)
    .map(m => `${m.is_dm ? '🐉 Dungeon Master' : m.display_name}: ${m.content}`)
    .join('\n');

  const prompt = [
    `Campaign: "${ctx.campaignName}" | Theme: ${ctx.theme} | Difficulty: ${ctx.difficulty}`,
    '',
    'Recent campaign log:',
    historyLines || '(The adventure is just beginning!)',
    '',
    `Player says: ${ctx.userMessage}`,
    '',
    'Respond as the Dungeon Master, continuing the story:',
  ].join('\n');

  const userId = 'dm-system';
  const sessionId = randomUUID();

  // Create an ephemeral (single-use) session for stateless per-request calls
  await runner.sessionService.createSession({
    appName: APP_NAME,
    userId,
    sessionId,
  });

  let response = '';
  for await (const event of runner.runAsync({
    userId,
    sessionId,
    newMessage: { role: 'user', parts: [{ text: prompt }] },
  })) {
    if (isFinalResponse(event) && event.content?.parts?.[0]?.text) {
      response = event.content.parts[0].text;
    }
  }

  return response.trim() || 'The Dungeon Master ponders your words in silence...';
}

