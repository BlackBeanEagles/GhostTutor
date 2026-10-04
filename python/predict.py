"""Predict per-topic exam success with TabPFN from the student's quiz-attempt table.

stdin:  {"train": [{feature..., "correct": 0|1}], "query": [{feature...}]}
stdout: {"ok": true, "engine": "...", "probs": [p_correct per query row]}

Uses the TabPFN cloud client when TABPFN_TOKEN is set, else the local `tabpfn`
package (runs on CPU for tables this small).
"""
import json
import os
import sys

FEATURES = ["topic", "difficulty", "hour", "seconds", "prior_attempts", "prior_accuracy", "days_since"]


def main():
    payload = json.load(sys.stdin)
    X = [[float(r[f]) for f in FEATURES] for r in payload["train"]]
    y = [int(r["correct"]) for r in payload["train"]]
    Q = [[float(r[f]) for f in FEATURES] for r in payload["query"]]

    token = os.environ.get("TABPFN_TOKEN")
    if token:
        import tabpfn_client
        from tabpfn_client import TabPFNClassifier

        tabpfn_client.set_access_token(token)
        engine = "tabpfn-client"
    else:
        from tabpfn import TabPFNClassifier

        engine = "tabpfn-local"

    clf = TabPFNClassifier()
    clf.fit(X, y)
    proba = clf.predict_proba(Q)
    classes = list(clf.classes_)
    idx = classes.index(1)
    print(json.dumps({"ok": True, "engine": engine, "probs": [float(p[idx]) for p in proba]}))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:  # reported back to node, which falls back gracefully
        print(json.dumps({"ok": False, "error": f"{type(e).__name__}: {e}"}))
