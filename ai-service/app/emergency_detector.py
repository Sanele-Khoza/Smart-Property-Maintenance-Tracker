"""Emergency / severity detection from ticket text.

Two layers, mirroring the backend `priorityDetector.js`:

1. A trained ML model (`priority_model.joblib`) when available — generalises to
   phrasing the fixed keyword lists miss (e.g. "exposed electrical wires").
2. A keyword heuristic fallback so the service behaves even before training.

`detect_priority()` is a pure function:

    {priority, confidence, matched}  where priority is one of
    LOW | MEDIUM | HIGH | EMERGENCY and matched holds the matched keywords.

EMERGENCY wins immediately on one hit; two HIGH hits also escalate; a single
HIGH maps to HIGH; one or more MEDIUM maps to MEDIUM.
"""

import joblib

from app.priority_model import PRIORITY_MODEL_PATH, PRIORITY_ORDER

_pmodel = None


def _load_priority_model():
    global _pmodel
    if _pmodel is None and PRIORITY_MODEL_PATH.exists():
        try:
            _pmodel = joblib.load(PRIORITY_MODEL_PATH)
        except Exception:
            _pmodel = None
    return _pmodel

EMERGENCY_KEYWORDS = [
    "gas leak", "gas smell", "carbon monoxide", "flooding", "flood", "burst pipe",
    "fire", "smoke", "electrical spark", "electrical fault", "live wire",
    "sewage overflow", "raw sewage", "structural collapse", "ceiling collapse",
    "collapse", "faulty wiring", "scorched", "burns", "burning",
    "exposed wires", "exposed wiring", "exposed electrical wires", "sparking wires",
    "spark wires", "sparking", "open wires", "loose wires",
]

HIGH_KEYWORDS = [
    "broken door", "security", "broken lock", "intruder", "water damage",
    "major leak", "pipe burst", "no water", "no power", "power outage",
    "no electricity", "fridge broken", "spoilt food", "broken window",
    "severe leak", "heavy leak", "leaking ceiling", "dangerous", "unsafe",
    "shock", "electrical shock",
    "electrical wire", "electrical wires", "unsafe wiring", "electrical hazard",
    "electrical danger", "wiring hazard",
]

MEDIUM_KEYWORDS = [
    "dripping", "leak", "slow drain", "clogged", "clog", "thermostat",
    "not cooling", "not heating", "inefficient", "noisy", "mold", "stained",
    "flickering", "not working", "broken", "damaged", "cracked", "maintenance",
]


def _hits(text: str, keywords) -> list[str]:
    return [kw for kw in keywords if kw in text]


def _keyword_priority(text: str) -> dict:
    """Keyword heuristic used when no trained model is available."""
    if not text:
        return {"priority": "LOW", "confidence": 0.4, "matched": []}

    lower = text.lower()

    emergencies = _hits(lower, EMERGENCY_KEYWORDS)
    if emergencies:
        return {"priority": "EMERGENCY", "confidence": 0.98, "matched": emergencies}

    highs = _hits(lower, HIGH_KEYWORDS)
    if len(highs) >= 2:
        return {"priority": "EMERGENCY", "confidence": 0.8, "matched": highs}
    if len(highs) == 1:
        return {"priority": "HIGH", "confidence": 0.75, "matched": highs}

    mediums = _hits(lower, MEDIUM_KEYWORDS)
    if mediums:
        return {"priority": "MEDIUM", "confidence": 0.6, "matched": mediums}

    return {"priority": "LOW", "confidence": 0.4, "matched": []}


def detect_priority(text: str | None) -> dict:
    """Return {priority, confidence, matched} for the given ticket text.

    Uses the trained model when present; otherwise the keyword heuristic.
    """
    model = _load_priority_model()
    if model is not None and text and text.strip():
        try:
            probs = model.predict_proba([text])[0]
            idx = int(probs.argmax())
            return {
                "priority": str(model.classes_[idx]),
                "confidence": round(float(probs[idx]), 4),
                "method": "sklearn",
                "matched": [],
            }
        except Exception:
            pass

    result = _keyword_priority(text)
    result["method"] = "keyword-fallback"
    return result


def is_emergency(text: str | None) -> bool:
    """Quick check used by scoring to decide whether to apply emergency weights."""
    return detect_priority(text)["priority"] == "EMERGENCY"


if __name__ == "__main__":
    samples = [
        "Gas leak detected in the main building, strong smoke coming out.",
        "There is water damage and the window is broken after the storm.",
        "The tap is dripping and the toilet is clogged.",
        "Everything seems fine, routine maintenance only.",
        "Structural collapse in block C, live wire exposed.",
    ]
    for s in samples:
        print(repr(s), "->", detect_priority(s))