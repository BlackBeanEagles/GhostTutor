"""Build a question-generation dataset from note files using a big open-weight teacher.

The teacher (e.g. Gemma 3 27B on a DigitalOcean GPU Droplet) writes questions; only those
that pass the validator are kept, so the student learns the *good* behaviour.

  python tinker/make_dataset.py notes/*.md --teacher-url http://<droplet>:11434/v1 --teacher gemma3:27b
"""
import argparse
import json
import random
import urllib.request
from pathlib import Path

from common import SYSTEM, check, chunks_from_notes, prompt_for


def ask(url, model, prompt, key="ollama"):
    body = json.dumps({
        "model": model, "temperature": 0.7, "response_format": {"type": "json_object"},
        "messages": [{"role": "system", "content": SYSTEM}, {"role": "user", "content": prompt}],
    }).encode()
    req = urllib.request.Request(f"{url}/chat/completions", body, {"Content-Type": "application/json", "Authorization": f"Bearer {key}"})
    with urllib.request.urlopen(req, timeout=180) as r:
        return json.load(r)["choices"][0]["message"]["content"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("notes", nargs="+")
    ap.add_argument("--teacher-url", required=True)
    ap.add_argument("--teacher", default="gemma3:27b")
    ap.add_argument("--per-chunk", type=int, default=3)
    ap.add_argument("--out", default="tinker/out")
    args = ap.parse_args()

    pairs = [p for f in args.notes for p in chunks_from_notes(Path(f).read_text(encoding="utf-8"))]
    random.seed(7)
    random.shuffle(pairs)
    split = max(1, len(pairs) // 5)
    test, train = pairs[:split], pairs[split:]   # held-out chunks never seen in training

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    (out / "test.jsonl").write_text("\n".join(json.dumps({"topic": t, "chunk": c}) for t, c in test), encoding="utf-8")

    kept = 0
    with (out / "train.jsonl").open("w", encoding="utf-8") as f:
        for topic, chunk in train:
            for _ in range(args.per_chunk):
                prompt = prompt_for(chunk, topic)
                try:
                    reply = ask(args.teacher_url, args.teacher, prompt)
                except Exception as e:
                    print("teacher error:", e)
                    continue
                if check(reply, chunk).get("pass"):
                    f.write(json.dumps({"prompt": prompt, "completion": reply.strip()}) + "\n")
                    kept += 1
    print(f"train examples kept: {kept}  |  held-out test chunks: {len(test)}")


if __name__ == "__main__":
    main()
