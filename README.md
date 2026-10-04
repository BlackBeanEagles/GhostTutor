# 👻 Ghost Tutor

A calm study ghost that quizzes a friend from **their own notes**, finds the topics they keep getting wrong, predicts their exam score, and haunts them (gently) every night until they're ready.

Built on open-weight **Gemma**. Runs fully on a laptop with no keys at all, and every partner integration switches on with one env var.

## Run it (2 minutes)

```bash
npm install
npm start            # http://localhost:3300
```

Open **Notes → Try sample notes → Feed notes**, then **Study**. With nothing else installed, questions come from the offline cloze generator.

### Turn on the real brain (Gemma, local)

```bash
# install Ollama from https://ollama.com, then:
ollama pull gemma3:4b
ollama pull nomic-embed-text
ollama pull gemma4:e2b-it-q4_K_M   # tool-calling model for the Ask agent (Gemma 3 cannot call tools)
```

Restart `npm start`. The footer should read `🧠 gemma3:4b (local)` and questions are tagged **by Gemma**.

## What it does

| Tab | What happens |
|---|---|
| **Study** | Picks the weakest/most overdue topic (recency-weighted Beta mastery + spaced repetition), generates a grounded MCQ, adapts difficulty, reacts in the chosen persona (Gentle / Hype coach / Roast), and reads aloud. Answer by tapping, keys `A–D`, or voice. |
| **Notes** | Paste or upload `.md`/`.txt`. `# Headings` become topics (Gemma splits un-headed notes). |
| **Progress** | Predicted exam score from **TabPFN**, plus per-topic mastery, a *drill* button, and live *web practice*. |
| **Plan** | A day-by-day plan up to the exam date, weakest topics first, ending in a mock test. |
| **Ask** | A Mastra agent on Gemma with tools over the notes, progress, memory and web search. Says when the notes don't cover something. |

## Partner map

Each partner has one job. Leave a variable unset and that part falls back to something local.

| Partner | Role in Ghost Tutor | Switch | Files |
|---|---|---|---|
| **Gemma** | The brain: topic splitting, question writing, reactions, nudges, agent | `LLM_BASE_URL`, `LLM_MODEL` | `server/llm.js`, `server/quiz.js` |
| **Mastra** | "Ask the Ghost" agent with tools `search_notes`, `get_progress`, `remember`, `find_web_practice` | `AGENT_MODEL` (Gemma 4, which supports tool calls) | `server/agent.js` |
| **TabPFN** | Predicts per-topic success from the quiz-attempt table (7 features) → exam score | `TABPFN_TOKEN` or `pip install tabpfn` | `python/predict.py`, `server/predict.js` |
| **Tinker** | LoRA fine-tune of a small open model for grounded question generation + a base-vs-tuned eval | `TINKER_API_KEY` | `tinker/` |
| **Temporal** | Durable nightly coach: at 9pm checks if they studied, leaves a nudge, waits 90 min, escalates. Activities retry with backoff | `TEMPORAL_ADDRESS` | `temporal/` |
| **ElevenLabs** | Tutor voice (TTS) and spoken answers (STT) | `ELEVENLABS_API_KEY` | `server/voice.js` |
| **MongoDB Atlas** | Student profile, long-term agent memory, quiz history, questions | `MONGODB_URI` | `server/store.js` |
| **Tiger Data** | pgvector + full-text **hybrid search** (RRF) over notes; Timescale hypertable of attempts | `DATABASE_URL` | `server/rag.js` |
| **SerpApi** | Fresh practice questions from the live web for a weak topic | `SERPAPI_KEY` | `server/search.js` |
| **DigitalOcean** | GPU Droplet serving Gemma 12B for the hosted version; teacher model for Tinker data | `LLM_BASE_URL` | `deploy/digitalocean.md` |
| **Render** | Hosts the web app + Temporal worker (Blueprint) | `render.yaml` | `render.yaml` |
| **Sentry** | Spans for every Gemma call (tokens), agent run, tool, TabPFN and ElevenLabs call | `SENTRY_DSN` | `server/tracing.js` |
| **GitHub Copilot** | CI (tests + offline boot smoke test) and Copilot PR review guided by repo instructions | n/a | `.github/` |
| **Entire / DevRelay** | Agent sessions embedded in the write-up | n/a | n/a |
| **Backboard** | Model comparison: point `tinker/eval.py openai --url` at Backboard's endpoint for each model | n/a | `tinker/eval.py` |

### Temporal (nightly nudges)

```bash
temporal server start-dev          # or Temporal Cloud: set TEMPORAL_ADDRESS/NAMESPACE/API_KEY
npm run worker                     # in another terminal
npm run schedule -- 21             # nudge at 21:00 for 14 nights
```

Kill the worker mid-wait and start it again. The workflow resumes where it was. That's the demo moment.

### Tinker (fine-tune + proof)

```bash
pip install tinker
python tinker/make_dataset.py my-notes/*.md --teacher-url http://<droplet>:11434/v1 --teacher gemma3:27b
python tinker/eval.py tinker --base Qwen/Qwen3-8B          # baseline
python tinker/train.py --base Qwen/Qwen3-8B --steps 60
python tinker/eval.py tinker --base Qwen/Qwen3-8B --model-path "$(cat tinker/out/model_path.txt)"
python tinker/eval.py openai --url http://localhost:11434/v1 --model gemma3:4b   # what ships today
```

The metric is mechanical, which keeps it fair: valid JSON, 4 distinct options, a valid answer index, and the correct option grounded in the held-out notes.

## Status: what is verified

- ✅ Offline mode end to end in a browser: notes → topics → cloze questions → grading → persona reactions → streak → progress → plan → Ask (sentence-level notes search) → nudge banner. Night + dawn themes, mobile 375px, no horizontal scroll.
- ✅ `npm test` (5 tests), Temporal workflow bundles cleanly, Tinker validator self-check.
- ⚠️ **Not yet run against live services** (no keys on the build machine): Gemma via Ollama, Mastra tool-calling, TabPFN, ElevenLabs, SerpApi, Atlas, Tiger, Sentry, Temporal server, Tinker. Each is wired, falls back gracefully, and needs one real run before the demo. `tinker/train.py` and `eval.py` follow the Tinker SDK cheatsheet (checked 2026-10-04) but have never run.

## Privacy

Notes, answers and the learner profile stay on the machine running the app (local JSON by default). With local Ollama, no study data reaches any model provider.
