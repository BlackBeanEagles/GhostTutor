# 👻 Ghost Tutor

> A study ghost that reads a friend's notes, finds the cracks, and haunts them until the exam.

Built on open-weight **Gemma**. Runs fully on a laptop with zero API keys. Every cloud integration switches on with one env var and falls back gracefully when it isn't set.

**Live demo →** [ghosttutors.onrender.com](https://ghosttutors.onrender.com)

---

## How it works

```
Your notes
    │
    ▼
[ Gemma splits into topics ]
    │
    ├──▶ Study tab  ──▶ MCQ written from your notes ──▶ answer ──▶ mastery score updated
    │                        ↑ weakest topic first (Beta + spaced repetition)
    │
    ├──▶ Ask tab    ──▶ Mastra agent picks a tool ──▶ search_notes / get_progress /
    │                        remember / find_web_practice ──▶ grounded answer
    │
    ├──▶ Report tab ──▶ TabPFN reads 7 features per attempt ──▶ predicted exam score
    │
    └──▶ Plan tab   ──▶ day-by-day schedule, weakest topics first, ends in mock test
```

At 9 pm each night, a **Temporal workflow** checks whether you studied, leaves a ghost note, waits 90 minutes, and escalates if still nothing. Kill the worker mid-wait, restart it — the nudge still fires.

---

## Quickstart

```bash
git clone https://github.com/BlackBeanEagles/GhostTutor
cd GhostTutor
npm install
npm start          # → http://localhost:3301
```

Paste some notes, hit **Feed notes**, then go to **Study**. With nothing else installed, it cuts fill-in-the-blank questions straight from your text. It labels them `offline · from your notes` so it never pretends to be smarter than it is.

### Add Gemma (local, no API key)

```bash
# 1. Install Ollama: https://ollama.com
ollama pull gemma3:4b            # question writer
ollama pull nomic-embed-text     # embeddings
ollama pull gemma4:e2b-it-q4_K_M # tool-calling agent (Gemma 3 can't call tools)
```

Restart `npm start`. The status bar reads `gemma3:4b · on this machine` and questions are tagged **by Gemma**.

### Add cloud Gemma (for hosted deployments)

```bash
# .env
LLM_BASE_URL=https://api-inference.huggingface.co/v1
LLM_MODEL=google/gemma-3-12b-it
LLM_API_KEY=hf_...
```

---

## Architecture

```
Browser (vanilla JS + CSS)
        │  fetch /api/*
        ▼
Express server (Node 20)
  ├── /api/quiz        server/quiz.js    ← Gemma writes MCQs
  ├── /api/agent       server/agent.js   ← Mastra agent loop
  ├── /api/notes       server/rag.js     ← pgvector + BM25 hybrid search
  ├── /api/predict     server/predict.js ← calls python/predict.py (TabPFN)
  ├── /api/search      server/search.js  ← SerpApi web practice
  └── /api/voice       server/voice.js   ← ElevenLabs TTS + STT

Storage layer
  ├── MongoDB Atlas   store.js   student profile, memory, quiz history, questions
  ├── Tiger Data      rag.js     pgvector notes index + Timescale attempts hypertable
  └── Local JSON      store.js   fallback when MONGODB_URI is unset

LLM layer
  ├── Gemma 3 4B (Ollama)             question writing, reactions, topic splitting
  ├── Gemma 4 E2B (Ollama / HF)       Mastra agent — picks tools on its own
  └── nomic-embed-text (Ollama / HF)  note embeddings for hybrid search

Background
  └── Temporal worker   temporal/worker.js   nightly coach workflow
```

---

## What each tab does

| Tab | What happens |
|---|---|
| **Study** | Picks the weakest, most overdue topic using a recency-weighted Beta mastery score and spaced repetition. Gemma writes a grounded MCQ from your notes. Adapts difficulty. Reacts in persona (Gentle / Hype / Roast). Reads the question aloud via ElevenLabs. Answer by tap, keys A–D, or voice. |
| **Notes** | Paste or upload `.md` / `.txt`. `# Headings` become topics; Gemma splits un-headed notes automatically. |
| **Report** | TabPFN predicts exam success per topic from 7 features (topic, difficulty, time of day, seconds taken, prior attempts, prior accuracy, days since last seen). Drill button re-queues any topic. Live web practice via SerpApi. |
| **Plan** | Day-by-day study schedule up to the exam date, weakest topics first, ending in a mock test. |
| **Ask** | A Mastra agent with four tools over your own data. Ask *"which topic am I weakest at?"* — it calls `get_progress`. Ask *"explain mitochondria"* — it calls `search_notes`. It picks correctly on its own. Grounded in your notes; says when something isn't covered. |

---

## Partner integrations

| Partner | Role | Env var | Falls back to |
|---|---|---|---|
| **Gemma** (Ollama / HF) | Brain: questions, reactions, topic split, agent | `LLM_BASE_URL` + `LLM_MODEL` + `LLM_API_KEY` | Offline cloze questions |
| **Mastra** | Ask tab agent orchestration | `AGENT_MODEL` | Disabled; Ask tab shows message |
| **MongoDB Atlas** | Student profile, long-term memory, quiz history | `MONGODB_URI` | Local JSON file |
| **Tiger Data** | pgvector hybrid search + Timescale attempts | `DATABASE_URL` | In-memory keyword search |
| **ElevenLabs** | Tutor voice (TTS) + spoken answers (STT) | `ELEVENLABS_API_KEY` | Browser speech API |
| **SerpApi** | Fresh web practice questions for weak topics | `SERPAPI_KEY` | Disabled |
| **Temporal** | Durable nightly nudge workflow | `TEMPORAL_ADDRESS` | Disabled |
| **Sentry** | Traces every LLM call, tool, and partner span | `SENTRY_DSN` | No-op spans |
| **Render** | Hosts web app + Temporal worker | `render.yaml` | — |
| **GitHub Copilot** | CI + automated PR review | `.github/` | — |

---

## Nightly nudge workflow (Temporal)

```bash
temporal server start-dev           # or set TEMPORAL_ADDRESS for Temporal Cloud
npm run worker                      # in a second terminal
npm run schedule -- 21              # nudge at 21:00 tonight
```

Kill the worker halfway through the wait. Restart it. The nudge still fires at the right time — that's what durable execution buys you over a `setTimeout`.

---

## The bug that justified the whole project

The first real question Gemma wrote:

> *Which organelle is responsible for cellular respiration?*
> Options: Ribosome / **Mitochondrion** / Lysosome / Golgi Apparatus
> `"answer": 2` ← Lysosome
> `"explanation": "The mitochondrion is the powerhouse of the cell…"`

The model's own explanation says Mitochondrion. Its answer index says Lysosome. Three runs out of three.

The fix: stop asking the model to count. It returns the correct answer *as text* plus three wrong ones. The server shuffles them and computes the index:

```js
const options = [correct, ...wrong].sort(() => Math.random() - 0.5);
return { options, answer: options.indexOf(correct) };
```

Two tests lock it down. You can only find this by running the thing.

---

## Privacy

Notes, answers, and the learner profile stay on the machine running the app (local JSON by default). With local Ollama, nothing leaves the laptop — no study data reaches any model provider.

---

## Tests

```bash
npm test
```

5 tests: MCQ answer-index correctness (runs the shuffle 20 times), offline cloze generator, topic parser, mastery score, agent tool schema.
