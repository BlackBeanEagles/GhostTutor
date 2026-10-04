"""LoRA fine-tune a small open-weight model on Tinker for grounded question generation.

  pip install tinker
  set TINKER_API_KEY=...            (from the Tinker console)
  python tinker/train.py --base Qwen/Qwen3-8B --steps 60

Calls follow the Tinker SDK cheatsheet + checkpoints guide (checked 2026-10-04).
"""
import argparse
import json
import random
from pathlib import Path

import tinker
from tinker import types

from common import SYSTEM, chat_prefix


def to_datum(tokenizer, prompt, completion):
    # Train only on the completion tokens: prompt tokens get weight 0.
    p = tokenizer.encode(chat_prefix(tokenizer, prompt), add_special_tokens=False)
    c = tokenizer.encode(completion + tokenizer.eos_token, add_special_tokens=False)
    tokens = p + c
    weights = [0] * len(p) + [1] * len(c)
    return types.Datum(
        model_input=types.ModelInput.from_ints(tokens=tokens[:-1]),
        loss_fn_inputs=dict(weights=[float(w) for w in weights[1:]], target_tokens=tokens[1:]),
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="Qwen/Qwen3-8B")
    ap.add_argument("--data", default="tinker/out/train.jsonl")
    ap.add_argument("--steps", type=int, default=60)
    ap.add_argument("--batch", type=int, default=8)
    ap.add_argument("--lr", type=float, default=1e-4)
    ap.add_argument("--rank", type=int, default=32)
    args = ap.parse_args()

    rows = [json.loads(l) for l in Path(args.data).read_text(encoding="utf-8").splitlines() if l.strip()]
    print(f"{len(rows)} training examples")

    service = tinker.ServiceClient()
    trainer = service.create_lora_training_client(base_model=args.base, rank=args.rank)
    tok = trainer.get_tokenizer()
    data = [to_datum(tok, r["prompt"], r["completion"]) for r in rows]

    random.seed(0)
    for step in range(args.steps):
        batch = random.sample(data, min(args.batch, len(data)))
        fb = trainer.forward_backward(data=batch, loss_fn="cross_entropy")
        opt = trainer.optim_step(types.AdamParams(learning_rate=args.lr))
        result = fb.result()
        opt.result()
        if step % 10 == 0:
            print(f"step {step:3d}  loss {getattr(result, 'loss', result)}")

    path = trainer.save_weights_for_sampler("ghost-tutor-qgen").result().path
    Path("tinker/out/model_path.txt").write_text(path, encoding="utf-8")
    print("saved sampler weights:", path)


if __name__ == "__main__":
    main()
