"""Audit the training CSVs without modifying them.

Prints per-file diagnostics:
  - row count and column names
  - missing values per column (count and %)
  - empty / whitespace-only texts
  - exact duplicate texts, plus conflicting duplicates (same text, different label)
  - class counts and percentages
  - row count after removing duplicate texts

Usage:
    python data_audit.py
"""

import pandas as pd
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent / "data"

# (task, filename, label column name)
FILES = [
    ("category", "categoryDataset18750.csv", "category"),
    ("priority", "priorityDataset18750.csv", "priority"),
]


def audit_csv(path: Path, label_col: str) -> dict:
    """Return a summary dict for one CSV. The file is only read, never modified."""
    df = pd.read_csv(path)
    text_col = df.columns[0]
    total = len(df)

    summary = {
        "file": path.name,
        "columns": list(df.columns),
        "rows": total,
        "text_col": text_col,
        "label_col": label_col,
    }

    # Missing values per column (count and percentage).
    missing = df.isna().sum()
    summary["missing"] = [
        (col, int(missing[col]), round(100.0 * missing[col] / total, 2))
        for col in df.columns
    ]

    # Empty / whitespace-only texts (NaNs coerce to "nan" via astype(str), so
    # treat actual string emptiness explicitly).
    texts = df[text_col].astype(str)
    blank = texts.str.strip().eq("")
    summary["blank_texts"] = int(blank.sum())

    # Exact duplicate texts and conflicting duplicates.
    dup_mask = texts.duplicated(keep=False)
    summary["exact_duplicate_texts"] = int(texts.duplicated().sum())
    summary["rows_in_duplicate_groups"] = int(dup_mask.sum())

    conflicting = 0
    if dup_mask.any():
        unique_labels_per_text = df[dup_mask].groupby(text_col)[label_col].nunique()
        conflicting = int((unique_labels_per_text > 1).sum())
    summary["conflicting_duplicates"] = conflicting

    # Class distribution.
    counts = df[label_col].value_counts()
    summary["class_counts"] = [
        (label, int(n), round(100.0 * n / total, 2)) for label, n in counts.items()
    ]

    # Row count after dropping duplicate texts (keep first occurrence).
    summary["rows_after_dedup"] = int(len(df[~texts.duplicated(keep="first")]))
    return summary


def main() -> None:
    for task, fname, label in FILES:
        print(f"\n=== AUDIT: {task}  ({fname}) ===")
        s = audit_csv(DATA_DIR / fname, label)
        print("columns: " + ", ".join(s["columns"]) + f"  |  total rows: {s['rows']}")
        for col, n, pct in s["missing"]:
            print(f"missing '{col}': {n} ({pct}%)")
        print("empty/whitespace texts:", s["blank_texts"])
        print(
            "exact duplicate texts:", s["exact_duplicate_texts"],
            "| rows in duplicate groups:", s["rows_in_duplicate_groups"],
        )
        print("conflicting duplicates (same text, different label):", s["conflicting_duplicates"])
        print("class distribution:")
        for label_, n, pct in s["class_counts"]:
            print(f"  {label_}: {n} ({pct}%)")
        print("rows after removing duplicate texts:", s["rows_after_dedup"])


if __name__ == "__main__":
    main()