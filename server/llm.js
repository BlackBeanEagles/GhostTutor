// Thin client for Gemma over the OpenAI-compatible API (Ollama, vLLM, DigitalOcean).
import { config } from './config.js';
import { traced } from './tracing.js';

let reachable = null;
let checkedAt = 0;

export async function llmAvailable() {
  if (reachable !== null && Date.now() - checkedAt < 30_000) return reachable;
  try {
    const r = await fetch(`${config.llm.baseUrl}/models`, {
      headers: { Authorization: `Bearer ${config.llm.apiKey}` },
      signal: AbortSignal.timeout(2500),
    });
    reachable = r.ok;
  } catch {
    reachable = false;
  }
  checkedAt = Date.now();
  return reachable;
}

export async function chat(messages, { json = false, schema = null, temperature = 0.4, maxTokens } = {}) {
  const format = schema
    ? { response_format: { type: 'json_schema', json_schema: { name: 'out', schema } } }
    : json ? { response_format: { type: 'json_object' } } : {};
  return traced('gen_ai.chat', { 'gen_ai.request.model': config.llm.model }, async (span) => {
    const r = await fetch(`${config.llm.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.llm.apiKey}` },
      body: JSON.stringify({
        model: config.llm.model,
        messages,
        temperature,
        ...(maxTokens ? { max_tokens: maxTokens } : {}),
        ...format,
      }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!r.ok) throw new Error(`LLM ${r.status}: ${await r.text()}`);
    const data = await r.json();
    span?.setAttribute('gen_ai.usage.input_tokens', data.usage?.prompt_tokens ?? 0);
    span?.setAttribute('gen_ai.usage.output_tokens', data.usage?.completion_tokens ?? 0);
    return data.choices[0].message.content;
  });
}

// With a JSON schema, Ollama constrains decoding to that shape (structured outputs).
export async function chatJSON(messages, schema = null, temperature = 0.3, maxTokens) {
  const text = await chat(messages, { json: true, schema, temperature, maxTokens });
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Model did not return JSON');
  return JSON.parse(match[0]);
}

export async function embed(texts) {
  const r = await fetch(`${config.llm.baseUrl}/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.llm.apiKey}` },
    body: JSON.stringify({ model: config.llm.embedModel, input: texts }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!r.ok) throw new Error(`Embeddings ${r.status}`);
  const data = await r.json();
  return data.data.map((d) => d.embedding);
}
