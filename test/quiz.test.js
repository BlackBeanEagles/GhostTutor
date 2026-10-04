import { test } from 'node:test';
import assert from 'node:assert/strict';
import { topicStats, pickTopic, updateStreak, buildMcq } from '../server/quiz.js';
import { featureRows } from '../server/predict.js';
import { chunkText } from '../server/rag.js';

const now = Date.now();
const attempts = [
  { at: now - 5000, topic: 'Hashing', correct: true, difficulty: 2, ms: 8000 },
  { at: now - 4000, topic: 'Hashing', correct: true, difficulty: 2, ms: 8000 },
  { at: now - 3000, topic: 'Graphs', correct: false, difficulty: 1, ms: 20000 },
  { at: now - 2000, topic: 'Graphs', correct: false, difficulty: 1, ms: 20000 },
];

test('mastery rises with right answers and falls with wrong ones', () => {
  const [h, g, s] = topicStats(['Hashing', 'Graphs', 'Sorting'], attempts);
  assert.ok(h.mastery > 0.6);
  assert.ok(g.mastery < 0.4);
  assert.equal(s.mastery, 0.5);
  assert.equal(s.daysSince, null);
});

test('scheduler prefers weak or unseen topics over mastered ones', () => {
  const stats = topicStats(['Hashing', 'Graphs'], attempts);
  const picks = Array.from({ length: 50 }, () => pickTopic(stats));
  assert.ok(picks.filter((p) => p === 'Graphs').length > 40);
});

test('feature rows only use information available before each answer', () => {
  const rows = featureRows(attempts, ['Hashing', 'Graphs']);
  assert.equal(rows[0].prior_attempts, 0);
  assert.equal(rows[1].prior_attempts, 1);
  assert.equal(rows[1].prior_accuracy, 1);
  assert.deepEqual(rows.map((r) => r.correct), [1, 1, 0, 0]);
});

test('streak continues from yesterday and resets after a gap', () => {
  const d = new Date(Date.now() - 86_400_000);
  const y = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  assert.equal(updateStreak({ streak: 4, lastQuizDay: y }).streak, 5);
  assert.equal(updateStreak({ streak: 4, lastQuizDay: '2000-1-1' }).streak, 1);
});

test('chunking keeps paragraphs together and bounds size', () => {
  const text = Array.from({ length: 10 }, (_, i) => `Paragraph ${i} `.repeat(20)).join('\n\n');
  const chunks = chunkText(text, 700);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((c) => c.length <= 1400));
});

test('correct answer index is computed by us, never trusted from the model', () => {
  const notes = 'Merge sort runs in O(n log n) in every case but needs O(n) extra memory.';
  for (let i = 0; i < 20; i++) {
    const q = buildMcq({ question: 'Which sort needs O(n) extra memory?', correct: 'Merge sort', wrong: ['Quicksort', 'Heapsort', 'Bubble sort'], explanation: 'x' }, notes, 2);
    assert.equal(q.options[q.answer], 'Merge sort');
  }
});

test('ungrounded or malformed model questions are rejected', () => {
  const notes = 'Merge sort runs in O(n log n) in every case.';
  assert.equal(buildMcq({ question: 'q', correct: 'Timsort hybrid galloping', wrong: ['a1', 'b1', 'c1'] }, notes, 1), null);
  assert.equal(buildMcq({ question: 'q', correct: 'Merge sort', wrong: ['Merge sort', 'b1', 'c1'] }, notes, 1), null);
  assert.equal(buildMcq({ question: 'q', correct: 'Merge sort', wrong: ['b1'] }, notes, 1), null);
});
