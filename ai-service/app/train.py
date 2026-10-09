"""Train the category classifier and persist it.

Trains on the merged on-disk dataset:
  - <repo-root>/training data/comprehend_training_data.csv  (curated real descriptions, ~256 rows)
  - ai-service/data/tickets_dataset.csv                     (synthetic, 5,000 rows)

The synthetic rows are regenerated with `python -m app.data_generator` if the
file is missing. Training in total runs on 5,000+ labelled samples.

Usage:
    python -m app.train
"""

import csv
import random
from pathlib import Path

import joblib

from app.comprehend_loader import load_comprehend_csv
from app.data_generator import generate_dataset
from app.model import build_pipeline, MODEL_PATH

CSV_PATH = Path(__file__).resolve().parents[1] / "data" / "tickets_dataset.csv"
REPO_ROOT = Path(__file__).resolve().parents[2]
COMPREHEND_CSV = REPO_ROOT / "training data" / "comprehend_training_data.csv"

SYNTHETIC_N_PER_CATEGORY = 625


def load_synthetic(path: Path) -> tuple[list[str], list[str]]:
    """Read the synthetic category CSV, or generate it if missing/empty."""
    if path.exists():
        texts, labels = [], []
        with open(path, newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                texts.append(row["text"])
                labels.append(row["category"])
        if texts:
            return texts, labels
    rows = generate_dataset(SYNTHETIC_N_PER_CATEGORY)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["text", "category"])
        writer.writeheader()
        writer.writerows(rows)
    return [r["text"] for r in rows], [r["category"] for r in rows]


def main() -> None:
    real = load_comprehend_csv(COMPREHEND_CSV)
    synth_texts, synth_labels = load_synthetic(CSV_PATH)

    texts = [r["text"] for r in real] + synth_texts
    labels = [r["category"] for r in real] + synth_labels

    rng = random.Random(42)
    pairs = list(zip(texts, labels))
    rng.shuffle(pairs)
    texts = [t for t, _ in pairs]
    labels = [l for _, l in pairs]

    pipe = build_pipeline()
    pipe.fit(texts, labels)
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipe, MODEL_PATH)

    from collections import Counter
    print(f"Trained on {len(texts)} samples (real={len(real)}, synthetic={len(synth_texts)}) -> saved to {MODEL_PATH}")
    print(f"Classes: {pipe.classes_.tolist()}")
    print(f"Label distribution: {dict(Counter(labels))}")


if __name__ == "__main__":
    main()