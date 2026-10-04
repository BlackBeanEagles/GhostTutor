// Activities talk to the Ghost Tutor server over HTTP, so the worker can run anywhere.
const BASE = process.env.GHOST_URL || 'http://localhost:3300';

async function call(path, init) {
  const r = await fetch(`${BASE}${path}`, init);
  if (!r.ok) throw new Error(`${path} -> ${r.status}`); // thrown errors are retried by Temporal
  return r.json();
}

export async function studiedToday() {
  const p = await call('/api/profile');
  const d = new Date();
  return p.lastQuizDay === `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export async function leaveNudge(level) {
  return call('/api/nudge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ level }),
  });
}

export async function msUntilHour(hour) {
  const now = new Date();
  const next = new Date(now);
  next.setHours(hour, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next - now;
}
