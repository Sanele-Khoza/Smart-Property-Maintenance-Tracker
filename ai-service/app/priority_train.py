"""Train the priority classifier and persist it.

Reads the labelled priority dataset at <repo-root>/training data/priority_training_data.csv
and trains a model that maps a ticket description to LOW | MEDIUM | HIGH | EMERGENCY.

Usage:
    python -m app.priority_train
"""

from pathlib import Path
import csv

import joblib
from sklearn.metrics import classification_report

from app.priority_model import (
    build_priority_pipeline,
    PRIORITY_MODEL_PATH,
    PRIORITY_LABELS,
)

REPO_ROOT = Path(__file__).resolve().parents[2]
CSV_PATH = REPO_ROOT / "training data" / "priority_training_data.csv"
CSV_EXTRA = REPO_ROOT / "training data" / "priority_training_data_2.csv"


def _reader(path: Path):
    # The 2nd dataset has a blank second header column holding the priority,
    # so we locate the priority column by position rather than name.
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.reader(f)
        header = next(reader)
        stripped = [h.strip() for h in header]
        if "priority" in stripped:
            prio_idx = stripped.index("priority")
        elif "" in stripped:
            prio_idx = stripped.index("")
        else:
            prio_idx = header.index("")
        for row in reader:
            if not row or not row[0].strip():
                continue
            yield row[0].strip(), (row[prio_idx] if prio_idx < len(row) else "").strip().upper()


def load_priority_dataset(path: Path) -> tuple[list[str], list[str]]:
    texts, labels = zip(*_reader(path)) if path.exists() else ([], [])
    return list(texts), list(labels)


def main() -> None:
    sources = [CSV_PATH, CSV_EXTRA]
    texts, labels = [], []
    for path in sources:
        if not path.exists():
            print(f"skipping missing priority dataset: {path}")
            continue
        t, l = load_priority_dataset(path)
        texts += t
        labels += l

    if not texts:
        raise FileNotFoundError("No priority training data found")

    pipe = build_priority_pipeline()
    pipe.fit(texts, labels)

    PRIORITY_MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipe, PRIORITY_MODEL_PATH)

    from collections import Counter
    print(f"Trained on {len(texts)} samples -> saved to {PRIORITY_MODEL_PATH}")
    print(f"Classes: {pipe.classes_.tolist()}")
    print(f"Label distribution: {dict(Counter(labels))}")

    # Quick in-sample sanity report (not a held-out evaluation, just a check).
    preds = pipe.predict(texts)
    print(classification_report(labels, preds, labels=PRIORITY_LABELS, zero_division=0))


if __name__ == "__main__":
    main()
