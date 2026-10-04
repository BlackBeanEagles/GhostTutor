// "Ask the Ghost": a Mastra agent on Gemma with tools over the student's own notes and progress.
import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { config } from './config.js';
import { chat, llmAvailable } from './llm.js';
import { search } from './rag.js';
import { topicStats } from './quiz.js';
import { findPractice, searchOn } from './search.js';
import { traced } from './tracing.js';

export function buildAgent(store) {
  const searchNotes = createTool({
    id: 'search_notes',
    description: "Search the student's own uploaded notes. Always use this before explaining a concept.",
    inputSchema: z.object({ query: z.string() }),
    execute: async ({ query }) => console.log(`[agent] tool search_notes("${query}")`) ||
      traced('ghost.tool.search_notes', { query }, async () =>
        (await search(query, await store.allChunks(), 4)).map((c) => ({ topic: c.topic, text: c.text }))),
  });

  const getProgress = createTool({
    id: 'get_progress',
    description: 'Get per-topic mastery (0-1), attempt counts and the exam date.',
    inputSchema: z.object({}),
    execute: async () => {
      console.log('[agent] tool get_progress()');
      const p = await store.getProfile();
      return { examDate: p.examDate, topics: topicStats(p.topics, await store.attempts()) };
    },
  });

  const webPractice = createTool({
    id: 'find_web_practice',
    description: 'Find fresh practice questions on the live web for a topic.',
    inputSchema: z.object({ topic: z.string() }),
    execute: async ({ topic }) => {
      const p = await store.getProfile();
      return findPractice(p.subject, topic);
    },
  });

  const remember = createTool({
    id: 'remember',
    description: 'Save a durable fact about the student (how they learn, what confuses them).',
    inputSchema: z.object({ fact: z.string() }),
    execute: async ({ fact }) => {
      const p = await store.getProfile();
      await store.saveProfile({ memories: [...(p.memories ?? []), fact].slice(-30) });
      return { saved: true };
    },
  });

  return new Agent({
    id: 'ghost-tutor',
    name: 'Ghost Tutor',
    instructions: async () => {
      const p = await store.getProfile();
      return `You are Ghost Tutor, a friendly study ghost helping ${p.name} pass ${p.subject}.
Persona: ${p.persona}. Keep answers short, clear and exam-focused.
Ground explanations in the student's notes via search_notes and say when the notes do not cover something.
Known about the student: ${(p.memories ?? []).join('; ') || 'nothing yet'}.`;
    },
    model: { id: `ollama/${config.llm.agentModel}`, url: config.llm.baseUrl, apiKey: config.llm.apiKey },
    tools: { searchNotes, getProgress, remember, ...(searchOn() ? { webPractice } : {}) },
  });
}

const QUESTION_WORDS = new Set('what why how when which who does the and are for with that this explain tell about mean means'.split(' '));

// Fallback when the agent loop fails (e.g. a small model that cannot call tools reliably).
async function ragAnswer(store, message) {
  const p = await store.getProfile();
  const hits = await search(message, await store.allChunks(), 4);
  if (!(await llmAvailable())) {
    const q = new Set((message.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []).filter((w) => !QUESTION_WORDS.has(w)));
    const best = hits
      .flatMap((h) => h.text.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/).map((s) => ({ s, topic: h.topic })))
      .map((x) => ({ ...x, score: (x.s.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []).filter((w) => q.has(w)).length }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    if (!best.length) return "Gemma is offline and I couldn't find that in your notes.";
    return `Gemma is offline, so here's what your notes say:\n\n${best.map((b) => `• (${b.topic}) ${b.s}`).join('\n')}`;
  }
  return chat([
    { role: 'system', content: `You are Ghost Tutor helping ${p.name} with ${p.subject}. Answer briefly using the notes; say if they don't cover it.` },
    { role: 'user', content: `NOTES:\n${hits.map((h) => h.text).join('\n---\n')}\n\nQUESTION: ${message}` },
  ]);
}

export async function ask(agent, store, message, history = []) {
  if (await llmAvailable()) {
    try {
      const res = await traced('gen_ai.invoke_agent', { 'gen_ai.agent.name': 'ghost-tutor' }, () =>
        agent.generate([...history.slice(-8), { role: 'user', content: message }], { maxSteps: 4 }));
      if (res.text?.trim()) return { text: res.text, via: 'mastra-agent' };
    } catch (e) {
      console.warn('[agent] falling back to RAG answer:', e.message);
    }
  }
  return { text: await ragAnswer(store, message), via: 'rag' };
}
