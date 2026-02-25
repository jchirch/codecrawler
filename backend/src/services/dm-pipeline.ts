import { GoogleGenAI } from '@google/genai';
import { RULES_AGENT_INSTRUCTION } from '../agents/rules-agent';
import { STATE_AGENT_INSTRUCTION } from '../agents/state-agent';
import { NARRATIVE_AGENT_INSTRUCTION } from '../agents/narrative-agent';

const MODEL = 'gemini-2.5-flash';

// ── Public types ─────────────────────────────────────────────────────────────
export interface PipelineContext {
  campaignName: string;
  theme: string;
  difficulty: string;
  recentMessages: Array<{ display_name: string; content: string; is_dm: boolean }>;
  userMessage: string;
  worldState: Record<string, unknown>;
}

export interface PipelineResult {
  narrative: string;
  updatedWorldState: Record<string, unknown>;
}

// ── Single agent call via @google/genai ──────────────────────────────────────
async function callAgent(
  agentName: string,
  systemInstruction: string,
  userPrompt: string,
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env['GEMINI_API_KEY']! });
  console.log(`[DM:${agentName}] calling Gemini...`);

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: userPrompt,
    config: { systemInstruction },
  });

  const text = (response.text ?? '').trim();
  console.log(`[DM:${agentName}] got response (${text.length} chars): ${text.slice(0, 120)}`);
  return text;
}

// ── Main entry point ─────────────────────────────────────────────────────────
export async function runDmPipeline(ctx: PipelineContext): Promise<PipelineResult> {
  if (!process.env['GEMINI_API_KEY']) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }

  const historyLines = ctx.recentMessages
    .map(m => `${m.is_dm ? '🐉 Dungeon Master' : m.display_name}: ${m.content}`)
    .join('\n');

  const baseContext = [
    `Campaign: "${ctx.campaignName}" | Theme: ${ctx.theme} | Difficulty: ${ctx.difficulty}`,
    '',
    'Recent campaign log:',
    historyLines || '(The adventure is just beginning!)',
    '',
    `Player says: ${ctx.userMessage}`,
  ].join('\n');

  // ── Step 1: Rules Agent ───────────────────────────────────────────────────
  const rulesOutput = await callAgent('rules_interpreter', RULES_AGENT_INSTRUCTION, baseContext);

  // ── Step 2: State Agent ───────────────────────────────────────────────────
  const statePrompt = [
    baseContext,
    '',
    '=== Rules Analysis ===',
    rulesOutput || '(no rules output)',
    '',
    '=== Current World State (JSON) ===',
    Object.keys(ctx.worldState).length > 0 ? JSON.stringify(ctx.worldState) : '{}',
  ].join('\n');

  const stateOutput = await callAgent('world_state_tracker', STATE_AGENT_INSTRUCTION, statePrompt);

  // ── Step 3: Narrative Agent ───────────────────────────────────────────────
  const narrativePrompt = [
    baseContext,
    '',
    '=== Rules Analysis ===',
    rulesOutput || '(no rules output)',
    '',
    '=== Updated World State (JSON) ===',
    stateOutput || JSON.stringify(ctx.worldState) || '{}',
  ].join('\n');

  const narrative = await callAgent(
    'dungeon_master_narrator',
    NARRATIVE_AGENT_INSTRUCTION,
    narrativePrompt,
  );

  // ── Parse updated world state ─────────────────────────────────────────────
  let updatedWorldState: Record<string, unknown> = ctx.worldState;
  if (stateOutput.trim()) {
    try {
      const cleaned = stateOutput.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
      updatedWorldState = JSON.parse(cleaned) as Record<string, unknown>;
    } catch {
      console.warn('[DM] Could not parse state output JSON — keeping previous state');
    }
  }

  return {
    narrative: narrative || 'The Dungeon Master ponders your words in silence...',
    updatedWorldState,
  };
}

