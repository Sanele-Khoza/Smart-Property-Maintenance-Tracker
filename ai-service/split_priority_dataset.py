"""Stratified 80/20 split of the cleaned priority dataset into train/test CSVs.

Reads  : data/priorityDataset_clean.csv              (columns: text, priority)
Writes : data/priority_train.csv and data/priority_test.csv

Uses the same random seed (42) as the rest of the training pipeline so the
partition is reproducible and matches the splits made by train_priority.py.

Usage:
    python split_priority_dataset.py
"""

import pandas as pd
from pathlib import Path
from sklearn.model_selection import train_test_split

DATA_DIR = Path(__file__).resolve().parent / "data"
SOURCE = DATA_DIR / "priorityDataset_clean.csv"
TRAIN_OUT = DATA_DIR / "priority_train.csv"
TEST_OUT = DATA_DIR / "priority_test.csv"

SEED = 42
TEST_SIZE = 0.2


def main() -> None:
    df = pd.read_csv(SOURCE)
    text_col, label_col = df.columns[0], df.columns[1]

    train, test = train_test_split(
        df,
        test_size=TEST_SIZE,
        stratify=df[label_col],
        random_state=SEED,
        shuffle=True,
    )

    train.to_csv(TRAIN_OUT, index=False)
    test.to_csv(TEST_OUT, index=False)

    print(f"source    : {SOURCE.name}  ({len(df)} rows)")
    print(f"train out : {TRAIN_OUT.name}  ({len(train)} rows)")
    print(f"test out  : {TEST_OUT.name}  ({len(test)} rows)")
    print("train class distribution:")
    print(train[label_col].value_counts().sort_index().to_string())


if __name__ == "__main__":
    main()