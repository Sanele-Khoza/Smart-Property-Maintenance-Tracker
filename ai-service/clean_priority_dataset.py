"""Clean the priority training CSV and write a de-duplicated copy.

Reads   : data/priorityDataset18750.csv   (columns: text, priority)
Writes  : data/priorityDataset_clean.csv  (same columns)

Cleaning applied (source file is never modified):
  - strips surrounding whitespace from text and label columns
  - drops rows with empty / whitespace-only text
  - drops rows with a missing or blank label
  - drops exact-duplicate texts, keeping the first occurrence

Usage:
    python clean_priority_dataset.py
"""

import pandas as pd
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent / "data"
SOURCE = DATA_DIR / "priorityDataset18750.csv"
OUTPUT = DATA_DIR / "priorityDataset_clean.csv"


def main() -> None:
    df = pd.read_csv(SOURCE)
    text_col, label_col = df.columns[0], df.columns[1]
    total = len(df)

    # Trim surrounding whitespace so ' dripping tap ' and 'dripping tap' match.
    df[text_col] = df[text_col].astype(str).str.strip()
    df[label_col] = df[label_col].astype(str).str.strip()

    # Drop blank / whitespace-only texts and rows without a label.
    before = len(df)
    df = df[(df[text_col].ne("")) & (df[label_col].ne(""))]
    dropped_blank = before - len(df)

    # Drop exact-duplicate texts, keeping the first occurrence.
    before_dedup = len(df)
    df = df.drop_duplicates(subset=text_col, keep="first").reset_index(drop=True)
    dropped_dup = before_dedup - len(df)

    df.to_csv(OUTPUT, index=False)
    print(f"source      : {SOURCE.name}  ({total} rows)")
    print(f"blank rows  : {dropped_blank}")
    print(f"duplicates  : {dropped_dup}")
    print(f"cleaned out : {OUTPUT.name}  ({len(df)} rows)")


if __name__ == "__main__":
    main()