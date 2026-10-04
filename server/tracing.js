// Sentry agent tracing. No-op when SENTRY_DSN is unset.
import * as Sentry from '@sentry/node';
import { config } from './config.js';

export const sentryOn = Boolean(config.sentryDsn);

if (sentryOn) {
  Sentry.init({ dsn: config.sentryDsn, tracesSampleRate: 1.0, sendDefaultPii: false });
}

export async function traced(name, attributes, fn) {
  if (!sentryOn) return fn(null);
  return Sentry.startSpan({ name, op: name.startsWith('gen_ai') ? name : 'ghost.tool', attributes }, fn);
}

export function captureError(err) {
  if (sentryOn) Sentry.captureException(err);
}
