/**
 * Groq client — SERVER-SIDE ONLY. API key never reaches the browser.
 */

import { Groq } from 'groq-sdk';

// Default chat model — overridable via SYNCAI_MODEL env var.
// (The previous default llama-3.3-70b-versatile was decommissioned for new keys.)
export const SYNCAI_MODEL = process.env.SYNCAI_MODEL || 'openai/gpt-oss-120b';

/**
 * Groq chat-capable models that the picker may offer. The list is a curated
 * snapshot of the live Groq model catalog — curated because the free tier
 * exposes far fewer models than the full catalog, and entries are added and
 * retired often. The `/api/syncai/models` endpoint filters this list against
 * the live catalog for the configured key; models that are not actually
 * accessible never reach the UI.
 */
export const AVAILABLE_MODELS: Array<{ id: string; label: string }> = [
  { id: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B' },
  { id: 'openai/gpt-oss-20b', label: 'GPT-OSS 20B' },
  { id: 'openai/gpt-oss-safeguard-20b', label: 'GPT-OSS 20B (Safeguard)' },
  { id: 'qwen/qwen3.8-27b', label: 'Qwen 3.8 27B' },
  { id: 'allam-2-7b', label: 'Allam 2 7B' },
];

let client: Groq | null = null;

export function getGroqClient(): Groq | null {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;
  if (!client) client = new Groq({ apiKey });
  return client;
}

export interface ChatCompletionMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function runChatCompletion(params: {
  messages: ChatCompletionMessage[];
  maxTokens?: number;
  temperature?: number;
  model?: string;
}): Promise<string> {
  const groq = getGroqClient();
  if (!groq) {
    throw new AiUnavailableError('AI service is not configured (missing GROQ_API_KEY).');
  }

  const model = params.model && AVAILABLE_MODELS.some((m) => m.id === params.model)
    ? params.model
    : SYNCAI_MODEL;
  const response = await groq.chat.completions.create({
    model,
    max_tokens: params.maxTokens ?? 1500,
    temperature: params.temperature ?? 0.3,
    messages: params.messages,
  });

  const text = response.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new AiUnavailableError('AI service returned an empty response.');
  }
  return text;
}

export class AiUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiUnavailableError';
  }
}
