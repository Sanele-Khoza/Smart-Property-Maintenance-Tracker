"""Load the AWS Comprehend curated training CSV and normalise it for the
SPMT category model.

Format:  CATEGORY,"free-text description with commas"
The file has c.257 labelled rows across PLUMBING / ELECTRICAL / HVAC /
STRUCTURAL plus EMERGENCY.

EMERGENCY in this CSV is a *severity/priority*, not an SPMT maintenance
category. We infer the underlying SPMT category from the description keywords
so those rich emergency examples still teach the model real category signal.
"""

import csv
import io
import json
import random
from pathlib import Path

from app.data_generator import CATEGORIES as SPMT_CATEGORIES
from app.data_generator import KEYWORD_POOL

# Normalise raw CSV labels -> SPMT categories (case-insensitive keys).
_LABEL_MAP = {
    "PLUMBING": "Plumbing",
    "ELECTRICAL": "Electrical",
    "HVAC": "HVAC",
    "STRUCTURAL": "Structural",
}

# Emergency rows: none of the raw EMERGENCY label is a category, so we infer
# the underlying SPMT category from keywords.
_EMERGENCY_KEYWORD_TO_CATEGORY = {
    "gas leak": "Plumbing",
    "gas": "Plumbing",
    "burst pipe": "Plumbing",
    "flood": "Plumbing",
    "water": "Plumbing",
    "sewage": "Plumbing",
    "fire": "Electrical",
    "smoke": "Electrical",
    "burning wire": "Electrical",
    "electrical": "Electrical",
    "spark": "Electrical",
    "wall socket": "Electrical",
    "panel": "Electrical",
    "smell burning": "Electrical",
    "carbon monoxide": "HVAC",
    "heater": "HVAC",
    "gas heating": "HVAC",
    "collapse": "Structural",
    "ceiling": "Structural",
    "structural": "Structural",
    "roof": "Structural",
    "wall": "Structural",
    "crack": "Structural",
}


def _split_once(line: str) -> tuple[str, str]:
    """Split 'LABEL,"desc"' on the first comma and strip surrounding quotes."""
    if "," not in line:
        return line.strip(), ""
    label, desc = line.split(",", 1)
    return label.strip(), desc.strip().strip('"')


def load_comprehend_csv(path: Path) -> list[dict]:
    """Return [{"text": ..., "category": ...}] normalised to SPMT categories.

    EMERGENCY rows are remapped to the underlying category via keyword hints;
    rows that cannot be mapped are dropped.
    """
    rows = []
    with open(path, newline="", encoding="utf-8") as f:
        for raw in f:
            raw = raw.strip()
            if not raw:
                continue
            label, desc = _split_once(raw)
            if not desc:
                continue
            desc = (desc or "").strip().strip('"')
            label_upper = label.upper()

            if label_upper in _LABEL_MAP:
                category = _LABEL_MAP[label_upper]
                rows.append({"text": desc, "category": category})
                continue

            if label_upper == "EMERGENCY":
                lower = desc.lower()
                matched = next(
                    (c for kw, c in _EMERGENCY_KEYWORD_TO_CATEGORY.items() if kw in lower),
                    None,
                )
                if matched:
                    rows.append({"text": desc, "category": matched})
                # else: unmappable emergency -> drop
                continue

            # Unknown label: keep only if it maps to a real SPMT category.
            candidate = label_upper.title()
            if candidate in SPMT_CATEGORIES:
                rows.append({"text": desc, "category": candidate})

    return rows


def build_merged_dataset(
    comprehend_path: Path,
    synthetic_n_per_category: int = 120,
    seed: int = 42,
) -> tuple[list[str], list[str]]:
    """Combine curated comprehend rows with synthetic data so every SPMT
    category is represented. Returns (texts, labels)."""
    from app.data_generator import generate_dataset

    synthetic = generate_dataset(synthetic_n_per_category, seed)

    real = load_comprehend_csv(comprehend_path)

    combined = {"text": [], "category": []}
    for r in real:
        combined["text"].append(r["text"])
        combined["category"].append(r["category"])
    for s in synthetic:
        combined["text"].append(s["text"])
        combined["category"].append(s["category"])

    rng = random.Random(seed)
    pairs = list(zip(combined["text"], combined["category"]))
    rng.shuffle(pairs)
    return [t for t, _ in pairs], [c for _, c in pairs]


if __name__ == "__main__":
    # Training data lives in <repo-root>/training data/
    repo_root = Path(__file__).resolve().parents[2]
    here = Path(__file__).resolve().parents[1]
    rows = load_comprehend_csv(repo_root / "training data" / "comprehend_training_data.csv")
    print(json.dumps(rows[:5], indent=2))
    from collections import Counter
    print(Counter(r["category"] for r in rows))