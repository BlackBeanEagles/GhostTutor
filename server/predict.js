// Score prediction. TabPFN (python/predict.py) learns from the quiz-attempt table;
// the Beta-posterior mastery is the fallback when TabPFN is unavailable or data is too thin.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { config, ROOT } from './config.js';
import { topicStats } from './quiz.js';
import { traced } from './tracing.js';

export function featureRows(attempts, topics) {
  const seen = {};
  return attempts.map((a) => {
    const prev = seen[a.topic] ?? { n: 0, c: 0, last: null };
    const row = {
      topic: Math.max(0, topics.indexOf(a.topic)),
      difficulty: a.difficulty ?? 2,
      hour: new Date(a.at).getHours(),
      seconds: Math.round((a.ms ?? 15000) / 1000),
      prior_attempts: prev.n,
      prior_accuracy: prev.n ? prev.c / prev.n : 0.5,
      days_since: prev.last ? (a.at - prev.last) / 86_400_000 : 7,
      correct: a.correct ? 1 : 0,
    };
    seen[a.topic] = { n: prev.n + 1, c: prev.c + (a.correct ? 1 : 0), last: a.at };
    return row;
  });
}

function queryRows(attempts, topics) {
  const now = Date.now();
  const hour = new Date().getHours();
  return topics.map((t, i) => {
    const mine = attempts.filter((a) => a.topic === t);
    return {
      topic: i, difficulty: 2, hour, seconds: 20,
      prior_attempts: mine.length,
      prior_accuracy: mine.length ? mine.filter((a) => a.correct).length / mine.length : 0.5,
      days_since: mine.length ? (now - mine.at(-1).at) / 86_400_000 : 7,
    };
  });
}

function runPython(payload) {
  return new Promise((resolve, reject) => {
    const p = spawn(config.python, [path.join(ROOT, 'python', 'predict.py')], {
      env: { ...process.env, TABPFN_TOKEN: config.tabpfnToken },
    });
    let out = '', err = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.on('error', reject);
    p.on('close', (code) => {
      try {
        const res = JSON.parse(out.trim().split('\n').at(-1));
        res.ok ? resolve(res) : reject(new Error(res.error));
      } catch { reject(new Error(err.slice(-400) || `python exited ${code}`)); }
    });
    p.stdin.end(JSON.stringify(payload));
  });
}

export async function predict(profile, attempts) {
  const topics = profile.topics;
  const stats = topicStats(topics, attempts);
  const rows = featureRows(attempts, topics);
  const classes = new Set(rows.map((r) => r.correct));
  let engine = 'beta-posterior';
  let probs = stats.map((s) => s.mastery);
  let note = rows.length < 12 ? `Need ${12 - rows.length} more answers before TabPFN kicks in.` : '';

  if (rows.length >= 12 && classes.size === 2) {
    try {
      const res = await traced('ghost.tabpfn.predict', { rows: rows.length }, () =>
        runPython({ train: rows, query: queryRows(attempts, topics) }));
      probs = res.probs;
      engine = res.engine;
      note = '';
    } catch (e) {
      console.warn('[predict] TabPFN failed:', e.message);
      note = /No module named/.test(e.message)
        ? 'TabPFN isn\'t installed yet (pip install -r python/requirements.txt).'
        : 'TabPFN couldn\'t run this time.';
    }
  }

  const perTopic = topics.map((t, i) => ({ ...stats[i], predicted: probs[i] }));
  const score = perTopic.length ? Math.round((perTopic.reduce((s, t) => s + t.predicted, 0) / perTopic.length) * 100) : null;
  return { engine, score, perTopic, note, rows: rows.length };
}
