/**
 * OpenAI-compatible provider call for BYO models.
 */

export interface CustomProviderOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  maxTokens?: number;
  temperature?: number;
}

export async function callCustomOpenAI(opts: CustomProviderOptions): Promise<string> {
  const base = opts.baseUrl.trim().replace(/\/+$/, '');
  const endpoint = base.endsWith('/chat/completions') ? base : `${base}/v1/chat/completions`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      model: opts.model,
      messages: opts.messages,
      max_tokens: opts.maxTokens ?? 1500,
      temperature: opts.temperature ?? 0.3,
    }),
  });

  if (!res.ok) {
    let reason = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      if (body.error?.message) reason = body.error.message;
    } catch {
      /* ignore */
    }
    throw new Error(`Custom model request failed (${reason})`);
  }

  const payload = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('Custom model returned an empty response.');
  return content;
}
