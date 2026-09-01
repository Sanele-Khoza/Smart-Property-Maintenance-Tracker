"""Loads the trained model once and provides a predict() helper.

Falls back to a lightweight keyword scoring heuristic when the model file
has not been trained yet, so the service remains usable out of the box.
"""

from pathlib import Path

import joblib

from app.model import MODEL_PATH, LABELS

_model = None


def _load_model():
    global _model
    if _model is None:
        if MODEL_PATH.exists():
            _model = joblib.load(MODEL_PATH)
        else:
            _model = None
    return _model


# Lightweight fallback so the service runs even before training.
_KEYWORD_MAP = {
    "Plumbing": ["leak", "pipe", "drain", "toilet", "sink", "faucet", "water", "clog", "sewer", "shower", "plumb"],
    "Electrical": ["electrical", "outlet", "switch", "light", "power", "breaker", "fuse", "socket", "spark", "wiring", "circuit"],
    "HVAC": ["hvac", "heating", "cooling", "air conditioner", "furnace", "thermostat", "aircon", "vent", "fan", "heat"],
    "Appliances": ["appliance", "fridge", "refrigerator", "dishwasher", "washer", "dryer", "stove", "oven", "microwave", "freezer"],
    "Structural": ["structural", "wall", "ceiling", "floor", "roof", "foundation", "crack", "window", "drywall", "mold", "stain"],
    "Security": ["security", "lock", "alarm", "camera", "doorbell", "key", "intrusion", "keypad", "intercom"],
    "Landscaping": ["garden", "lawn", "fence", "tree", "grass", "sprinkler", "yard", "weed", "gate", "irrigation"],
    "Pest Control": ["pest", "bug", "rat", "mouse", "cockroach", "termite", "ant", "infestation", "roach", "rodent"],
}


def _fallback_predict(text: str) -> tuple[str, float]:
    lower = text.lower()
    best_cat, best_score = "Other", 0.0
    for cat, kws in _KEYWORD_MAP.items():
        hits = sum(1 for k in kws if k in lower)
        score = hits / max(1, len(kws) * 0.3)
        if score > best_score:
            best_cat, best_score = cat, min(score, 1.0)
    if best_score <= 0:
        return "Other", 0.0
    return best_cat, round(max(best_score, 0.5), 4)


def predict(text: str) -> dict:
    """Return {category, confidence, method}. confidence in [0,1]."""
    if not text or not text.strip():
        return {"category": "Other", "confidence": 0.0, "method": "none"}

    model = _load_model()
    if model is None:
        cat, conf = _fallback_predict(text)
        return {"category": cat, "confidence": conf, "method": "keyword-fallback"}

    probs = model.predict_proba([text])[0]
    idx = int(probs.argmax())
    return {
        "category": str(model.classes_[idx]),
        "confidence": round(float(probs[idx]), 4),
        "method": "sklearn",
    }


if __name__ == "__main__":
    for sample in [
        "Plumbing issue: The tap dripping in the kitchen is leaking.",
        "Electrical issue: Noticed that the outlet at the bedroom requires repair.",
        "Termites infestation in the ceiling.",
    ]:
        print(sample, "->", predict(sample))
