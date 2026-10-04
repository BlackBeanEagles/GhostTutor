---
title: I built my friend a study ghost that runs with the Wi-Fi off
published: false
tags: devchallenge, weekendchallenge, hf26challenge
---

*This is a submission for the [Hacktoberfest Weekend Challenge: Build for a Friend](https://dev.to/challenges/hacktoberfest-weekend-2026-10-01)*

## What I Built

Three days before [[FRIEND]]'s [[SUBJECT]] exam, the problem was not that they weren't studying. They were studying constantly, and still failing, because they were re-reading the chapters they already knew. Nobody had ever told them which topics they were actually weak at. You can't see that from the inside.

So I built **Ghost Tutor**: a study ghost that lives in a notebook on a desk, reads *their* notes, and quizzes them until it finds the cracks.

You paste in your notes. The ghost splits them into topics, writes multiple-choice questions grounded in your own material, and tracks which topics you keep getting wrong. It always serves your weakest topic first. It marks your wrong answers in red pen, bleeds ink into the page, throws a crumpled ball of paper onto the desk, and stamps your report card like a tired teacher: `READY`, `NEEDS WORK`, or `SEE ME AFTER CLASS`.

It also roasts you, if you ask it to. You pick the ghost's mood by its face.

The important part: **it runs entirely on a laptop.** No account, no API key, no internet. Their notes never leave their machine.

---

## Demo

[[DEMO: 60–90s video. Suggested beats:
  1. Paste real notes → topics appear as coloured index flags
  2. Answer a question wrong → red strike-through, ink bleed, crumpled paper lands on the desk
  3. Report card → red circled score + rubber stamp
  4. Turn off Wi-Fi → ask another question → it still works. This is the money shot.
  5. Your friend's face when they use it ]]

![Ghost Tutor on a desk at night](IMAGE)

---

## Code

{% embed https://github.com/BlackBeanEagles/GhostTutor %}

Clone it and you are two commands from a working tutor:

```bash
npm install && npm start
```

With nothing else installed it still works — it cuts fill-in-the-blank questions straight out of your notes and labels them `offline · from your notes`, so it never pretends to be smarter than it is. Add Ollama and the ghost starts writing real questions.

---

## How I Built It

**Gemma 3 4B** (open weights, via **Ollama**) is the brain. It splits notes into topics, writes the questions, reacts in character, and explains the answers. Embeddings come from `nomic-embed-text`, also local.

**Mastra** runs the "Ask the Ghost" agent, with four tools over the student's own data: `search_notes`, `get_progress`, `remember`, and `find_web_practice`. Ask *"which topic am I weakest at?"* and it calls `get_progress`; ask *"explain Kruskal's algorithm"* and it calls `search_notes`. It picks correctly on its own — here it is in the server log, deciding:

```
[agent] tool get_progress()
[agent] tool search_notes("Kruskal's algorithm")
```

**TabPFN** predicts per-topic exam success from the quiz-attempt table — seven features per answer (topic, difficulty, time of day, seconds taken, prior attempts, prior accuracy, days since last seen), computed so each row only sees information available *before* that answer.

**Temporal** runs the nightly nudge as a durable workflow: at 9pm it checks whether you studied, leaves a note on your desk, waits 90 minutes, then escalates. Kill the worker mid-wait and restart it, and the nudge still fires. A `setTimeout` would have died with the process.

### The bug that justifies the whole project

The first real question Gemma wrote was good:

> *Which sorting algorithm guarantees O(n log n) in all cases but requires O(n) extra memory?*
> Options: Quicksort / **Merge Sort** / Heapsort / Bubble Sort
> `"answer": 2` ← Heapsort
> `"explanation": "Merge sort divides the array in half... it needs O(n) extra memory."`

Read it twice. The model's own explanation says Merge Sort. Its answer index says Heapsort. It did this on **three runs out of three.** A 4B model can reason about the content and still not count to two.

If I had shipped that, my friend would have been taught the wrong answer, in their own notes' words, with a confident explanation attached. That is worse than no tutor at all.

The fix was to stop asking the model to do the thing it is bad at. Now it returns the correct answer *as text* plus three wrong ones, and my code shuffles them and computes the index:

```js
const options = [correct, ...wrong].sort(() => Math.random() - 0.5);
return { options, answer: options.indexOf(correct) };
```

Then it checks the correct answer actually appears in the student's notes, and regenerates if it doesn't. Two tests lock it down — one runs the shuffle 20 times and asserts the index always lands on the right option.

Gemma also returned 8 options because it copied my prompt's placeholder letters, asked the same question three times in a row, and leaked `**` markdown into the ghost's dialogue. All fixed, all found by running it.

---

## Why Does Open Innovation Matter?

**I could see the model fail.** That is the entire argument. A closed API would have handed me the same confidently wrong JSON, and I would have had no way to watch it happen three times, read the raw output, and conclude *this model cannot pick an index.* I could run it a hundred times for free while I figured that out. Metering that debugging loop would have shortened it, and I'd have shipped the bug.

**I swapped the model mid-build, in one line.** Gemma 3 can't call tools in Ollama, so the Mastra agent couldn't use its tools. I pulled Gemma 4, set `AGENT_MODEL=gemma4:e2b-it-q4_K_M`, and the agent started calling `get_progress` on its own. Questions still run on Gemma 3, because it's faster. Two models, each doing what it's good at, picked by me, swappable by anyone who clones this.

**It costs nothing per question.** Someone cramming for an exam asks hundreds of questions a night. Any per-token price turns a study tool into a thing you ration. The ghost is free to pester you forever, which is the only way a tutor works.

**Their notes stay theirs.** A student's notes are an unflattering picture of what they don't understand yet. Those shouldn't be sitting in someone's logs. On this build they never leave the laptop.

**And it works with the Wi-Fi off.** That's not a hypothetical where I live. It is the difference between a study tool and a study tool *that was there the night before the exam*.

---

## My Agent Session

[[Upload your session to DevRelay and paste the ID: {% agent_session YOUR_ID %}]]

---

## Prize Categories

- **Best Use of Gemma** — Gemma 3 4B writes every question and explanation locally; Gemma 4 E2B drives the tool-calling agent.

[[Add the others ONLY after you've run them once with real keys. See the checklist in HANDOVER.md.]]

---

## What [[FRIEND]] said

> [[Hand it over. Record what they actually say, even if it's "why is there a cat".]]
