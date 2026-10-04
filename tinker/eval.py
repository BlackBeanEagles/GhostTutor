"""Compare question quality + latency on held-out chunks.

  # base model on Tinker vs your fine-tune on Tinker
  python tinker/eval.py tinker --base Qwen/Qwen3-8B
  python tinker/eval.py tinker --base Qwen/Qwen3-8B --model-path "$(cat tinker/out/model_path.txt)"
  # what the app ships today: local Gemma via Ollama
  python tinker/eval.py openai --url http://localhost:11434/v1 --model gemma3:4b

Prints pass-rate (valid JSON + 4 distinct options + grounded answer) and median latency.
Paste the table into the write-up.
"""
import argparse
import json
import statistics
import time
import urllib.request
from pathlib import Path

from common import SYSTEM, chat_prefix, check, prompt_for


def openai_gen(url, model):
    def gen(prompt):
        body = json.dumps({"model": model, "temperature": 0.3,
                           "messages": [{"role": "system", "content": SYSTEM}, {"role": "user", "content": prompt}]}).encode()
        req = urllib.request.Request(f"{url}/chat/completions", body, {"Content-Type": "application/json", "Authorization": "Bearer ollama"})
        with urllib.request.urlopen(req, timeout=180) as r:
            return json.load(r)["choices"][0]["message"]["content"]
    return gen


def tinker_gen(base=None, model_path=None):
    import tinker
    from tinker import types

    service = tinker.ServiceClient()
    client = service.create_sampling_client(model_path=model_path) if model_path else service.create_sampling_client(base_model=base)
    if hasattr(client, "get_tokenizer"):
        tok = client.get_tokenizer()
    else:
        from transformers import AutoTokenizer
        tok = AutoTokenizer.from_pretrained(base or "Qwen/Qwen3-8B")

    def gen(prompt):
        ids = tok.encode(chat_prefix(tok, prompt), add_special_tokens=False)
        res = client.sample(prompt=types.ModelInput.from_ints(tokens=ids), num_samples=1,
                            sampling_params=types.SamplingParams(max_tokens=350, temperature=0.3)).result()
        return tok.decode(res.sequences[0].tokens, skip_special_tokens=True)
    return gen


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("backend", choices=["openai", "tinker"])
    ap.add_argument("--url")
    ap.add_argument("--model")
    ap.add_argument("--base")
    ap.add_argument("--model-path")
    ap.add_argument("--test", default="tinker/out/test.jsonl")
    ap.add_argument("--samples", type=int, default=3)
    args = ap.parse_args()

    gen = openai_gen(args.url, args.model) if args.backend == "openai" else tinker_gen(args.base, args.model_path)
    label = args.model or args.model_path or args.base
    rows = [json.loads(l) for l in Path(args.test).read_text(encoding="utf-8").splitlines() if l.strip()]

    results, lat = [], []
    for r in rows:
        for _ in range(args.samples):
            t = time.perf_counter()
            try:
                out = gen(prompt_for(r["chunk"], r["topic"]))
            except Exception as e:
                out = ""
                print("error:", e)
            lat.append(time.perf_counter() - t)
            results.append(check(out, r["chunk"]))

    n = len(results)
    rate = lambda k: sum(1 for x in results if x.get(k)) / n
    print(f"\n| model | n | valid JSON | well-formed | grounded pass | median latency |")
    print(f"|---|---|---|---|---|---|")
    print(f"| {label} | {n} | {rate('json'):.0%} | {rate('shape'):.0%} | {rate('pass'):.0%} | {statistics.median(lat):.1f}s |")


if __name__ == "__main__":
    main()
