import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('..', import.meta.url));
dotenv.config({ path: `${ROOT}/.env`, quiet: true });

const env = process.env;

export const config = {
  port: Number(env.PORT || 3300),
  // Gemma via any OpenAI-compatible server: local Ollama by default,
  // or a DigitalOcean GPU Droplet running Ollama/vLLM.
  llm: {
    baseUrl: (env.LLM_BASE_URL || 'http://localhost:11434/v1').replace(/\/$/, ''),
    model: env.LLM_MODEL || 'gemma3:4b',
    // The Mastra agent needs a tool-calling model; Gemma 4 supports tools, Gemma 3 does not.
    agentModel: env.AGENT_MODEL || 'gemma4:e2b-it-q4_K_M',
    embedModel: env.EMBED_MODEL || 'nomic-embed-text',
    apiKey: env.LLM_API_KEY || 'ollama',
    host: env.LLM_HOST_LABEL || 'local',
  },
  mongoUri: env.MONGODB_URI || '',
  pgUrl: env.DATABASE_URL || '', // Tiger Data (Postgres + pgvector + Timescale)
  elevenKey: env.ELEVENLABS_API_KEY || '',
  elevenVoice: env.ELEVENLABS_VOICE_ID || 'JBFqnCBsd6RMkjVDRZzb',
  serpKey: env.SERPAPI_KEY || '',
  tabpfnToken: env.TABPFN_TOKEN || '',
  sentryDsn: env.SENTRY_DSN || '',
  temporalAddress: env.TEMPORAL_ADDRESS || '',
  python: env.PYTHON_BIN || 'python',
};
