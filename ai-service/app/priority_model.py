"""Priority classification model built with scikit-learn.

Pipeline: TfidfVectorizer -> LinearSVC (calibrated for probabilities), trained
offline via priority_train.py and persisted with joblib. detect_priority()
in emergency_detector.py is a keyword fallback; when a trained model exists the
service prefers it because it generalises to phrasing the keyword lists miss
(e.g. "exposed electrical wires").
"""

from pathlib import Path

from sklearn.calibration import CalibratedClassifierCV
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.pipeline import Pipeline
from sklearn.svm import LinearSVC

PRIORITY_MODEL_PATH = (
    Path(__file__).resolve().parents[1] / "models" / "priority_model.joblib"
)

PRIORITY_LABELS = ["LOW", "MEDIUM", "HIGH", "EMERGENCY"]

PRIORITY_ORDER = {"EMERGENCY": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}


def build_priority_pipeline() -> Pipeline:
    return Pipeline(
        [
            (
                "tfidf",
                TfidfVectorizer(
                    lowercase=True,
                    strip_accents="unicode",
                    ngram_range=(1, 3),
                    sublinear_tf=True,
                    max_features=20000,
                ),
            ),
            ("clf", CalibratedClassifierCV(LinearSVC(class_weight="balanced"), cv=3)),
        ]
    )


if __name__ == "__main__":
    print("Module: priority_model.py")
