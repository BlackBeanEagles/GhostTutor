import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });

export const TASK_QUEUE = 'ghost-tutor';
export const address = process.env.TEMPORAL_ADDRESS || 'localhost:7233';
export const namespace = process.env.TEMPORAL_NAMESPACE || 'default';
// Temporal Cloud uses an API key + TLS; a local dev server (temporal server start-dev) needs neither.
export const apiKey = process.env.TEMPORAL_API_KEY || undefined;
export const connectionOptions = { address, ...(apiKey ? { apiKey, tls: true } : {}) };
