"""Shared prompt + validator for the question-generation task.

The metric is deliberately mechanical so base vs fine-tuned is a fair fight:
a generated question "passes" only if it is valid JSON, has 4 distinct options,
a valid answer index, and the correct option is grounded in the source notes.
"""
import json
import re

SYSTEM = "You write one exam multiple-choice question strictly grounded in the given notes. Reply with JSON only."


def prompt_for(chunk: str, topic: str) -> str:
    return (
        f"Topic: {topic}\n"
        'Return {"question":"...","options":["a","b","c","d"],"answer":<0-3>,"explanation":"..."}\n\n'
        f"NOTES:\n{chunk}"
    )


def _words(s):
    return set(re.findall(r"[a-z0-9]{4,}", s.lower()))


def check(output: str, chunk: str) -> dict:
    res = {"json": False, "shape": False, "grounded": False}
    m = re.search(r"\{[\s\S]*\}", output or "")
    if not m:
        return res
    try:
        q = json.loads(m.group(0))
    except json.JSONDecodeError:
        return res
    res["json"] = True
    opts = q.get("options")
    ans = q.get("answer")
    if isinstance(opts, list) and len(opts) == 4 and len({str(o).strip().lower() for o in opts}) == 4 \
            and isinstance(ans, int) and 0 <= ans < 4 and str(q.get("question", "")).strip():
        res["shape"] = True
        correct = _words(str(opts[ans]))
        res["grounded"] = bool(correct) and len(correct & _words(chunk)) / len(correct) >= 0.5
    res["pass"] = res["json"] and res["shape"] and res["grounded"]
    return res


def chunks_from_notes(text: str, size: int = 700):
    """Split '# Topic' markdown notes into (topic, chunk) pairs."""
    topic, buf, out = "Notes", "", []
    for line in text.splitlines():
        h = re.match(r"^\s{0,3}#{1,3}\s+(.+)", line)
        if h:
            if buf.strip():
                out.append((topic, buf.strip()))
            topic, buf = h.group(1).strip(), ""
            continue
        buf += line + "\n"
        if len(buf) > size and line.strip() == "":
            out.append((topic, buf.strip()))
            buf = ""
    if buf.strip():
        out.append((topic, buf.strip()))
    return out


def chat_prefix(tokenizer, prompt: str) -> str:
    """The model's own chat template up to the start of the assistant turn."""
    messages = [{"role": "system", "content": SYSTEM}, {"role": "user", "content": prompt}]
    return tokenizer.apply_chat_template(messages, add_generation_prompt=True, tokenize=False)
