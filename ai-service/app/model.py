"""Category classification model built with scikit-learn.

Pipeline: TfidfVectorizer -> LinearSVC (works well for short, multi-class
text and is fast / low-memory). A model is trained offline via `train.py`
and persisted with joblib. `classifier.py` loads the trained model and
exposes a predict() function used by the HTTP routes.
"""

from pathlib import Path

from sklearn.calibration import CalibratedClassifierCV
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.pipeline import Pipeline
from sklearn.svm import LinearSVC

MODEL_PATH = Path(__file__).resolve().parents[1] / "models" / "category_model.joblib"

LABELS = [
    "Plumbing",
    "Electrical",
    "HVAC",
    "Appliances",
    "Structural",
    "Security",
    "Landscaping",
    "Pest Control",
]


def build_pipeline() -> Pipeline:
    return Pipeline(
        [
            (
                "tfidf",
                TfidfVectorizer(
                    lowercase=True,
                    strip_accents="unicode",
                    ngram_range=(1, 2),
                    sublinear_tf=True,
                    max_features=20000,
                ),
            ),
            ("clf", CalibratedClassifierCV(LinearSVC(class_weight="balanced"), cv=3)),
        ]
    )


if __name__ == "__main__":
    print("Module: model.py")
