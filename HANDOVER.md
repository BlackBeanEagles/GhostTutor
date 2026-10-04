# Before you hit Publish

## 1. The four blanks in the post (only you can fill these)

| Blank | What it needs |
|---|---|
| `[[FRIEND]]` | A **real** person's name, and their permission to be named. |
| `[[SUBJECT]]` | What they're actually studying. |
| `[[DEMO]]` | A 60–90s video. The Wi-Fi-off moment is the one judges remember. |
| `What [[FRIEND]] said` | Hand it over, then quote them verbatim. |

The theme is *Build for a Friend*, and judges weight writing quality highest. A real person with a real reaction beats any extra sponsor. **Don't invent this part** — the post falls apart if that paragraph isn't true.

Right now the app has your own name in it, so this hasn't happened yet.

## 2. What you can honestly claim today

Verified running on your laptop (RTX 4060):

| Works | Evidence |
|---|---|
| Gemma 3 4B writes grounded questions | ~2s per question, source labelled `written by Gemma` |
| Gemma 4 E2B agent calls its own tools | server log shows `get_progress()` / `search_notes(...)` |
| `nomic-embed-text` indexes notes | 4 topics in 7.5s |
| Fully offline fallback | cloze questions + keyword search, no keys |
| 7 unit tests | `npm test` |

## 3. Not yet true — do NOT claim these until you run them

Each is wired and degrades gracefully, but **none has run against a live service.** Turn one on, use it once, screenshot it, *then* add its prize category.

| Partner | To switch on | Needed for the claim |
|---|---|---|
| TabPFN | `pip install -r python/requirements.txt` (or set `TABPFN_TOKEN`) | Answer 12+ questions, show the score change engine to `tabpfn-*` |
| ElevenLabs | `ELEVENLABS_API_KEY` | One spoken question in the demo video |
| MongoDB Atlas | `MONGODB_URI` | Footer must read `memory mongodb-atlas` |
| Tiger Data | `DATABASE_URL` | Footer must read `recall tiger-pgvector-hybrid` |
| SerpApi | `SERPAPI_KEY` | Click "web" on a weak topic, show the results |
| Sentry | `SENTRY_DSN` | Screenshot one agent trace |
| Temporal | `temporal server start-dev` + `npm run worker` + `npm run schedule -- 21` | Kill the worker mid-wait, restart, show the nudge still fires |
| Render | deploy `render.yaml` | A live URL |
| DigitalOcean | `deploy/digitalocean.md` | Point `LLM_BASE_URL` at the droplet |
| Tinker | `pip install tinker`, run `tinker/eval.py` before and after `train.py` | **Only claim a Tinker win if the eval table shows a real improvement.** Scripts follow the SDK docs but have never run. |

Entering a category with a sponsor you merely imported reads worse than not entering it.

## 4. Quick wins worth doing first

1. **Temporal** — the "kill the worker, nudge still fires" demo is 10 minutes of work and is the single most convincing clip in the whole video.
2. **TabPFN** — one `pip install`, no account needed. It changes a real number on the report card.
3. **DevRelay** — upload this build session, paste the ID into the post. Free points, and judges like seeing the process.

## 5. Reset before you record

The app currently has your test data in it. To hand your friend a clean notebook:

```bash
rm data/db.json
```

Then start fresh with their real notes.
