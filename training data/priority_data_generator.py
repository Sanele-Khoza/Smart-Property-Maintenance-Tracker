"""Generate a synthetic labelled dataset for priority detection.

Each row is a ticket description mapped to one of four priorities:
    LOW | MEDIUM | HIGH | EMERGENCY

Labels mirror the severity rules the system uses so the trained model is
consistent with the keyword heuristic (and generalises better on phrasing the
heuristic misses, such as "exposed electrical wires").

Output CSV (with header row):  text,priority
    GLOBAL_TARGET  -> total samples to write (default 1500)
Rows are seeded so results are reproducible across runs.
"""

import random
import csv
from pathlib import Path

PRIORITIES = ["LOW", "MEDIUM", "HIGH", "EMERGENCY"]

# Keyword pools per priority — a sample that hits one (or more) is labelled at
# least that severity (EMERGENCY best-wins).
EMERGENCY = [
    "gas leak", "gas smell", "smelling gas", "carbon monoxide detector going off",
    "flooding in the unit", "water flooding", "burst pipe", "pipe burst",
    "fire down the hall", "electrical fire", "smoke coming from", "smoke in the unit",
    "electrical spark", "sparks flying", "sparking wires", "exposed electrical wires",
    "exposed wires", "exposed wiring", "live wire", "loose live wires",
    "sewage overflowing", "raw sewage", "sewer backing up into the unit",
    "structural collapse", "ceiling collapse", "the ceiling is caving in",
    "the wall is collapsing", "collapsing wall", "faulty wiring causing sparks",
    "scorched outlet", "burning smell", "the unit is burning",
]

HIGH = [
    "broken door", "security alarm triggered", "broken lock", "intruder in the building",
    "water damage to the ceiling", "major leak", "severe leak", "heavy leak",
    "no water in the unit", "water shut off", "no power", "power outage",
    "no electricity", "entire unit without power", "fridge broke down",
    "spoilt food in the fridge", "broken window", "shattered window",
    "leaking ceiling", "the ceiling is leaking", "dangerous", "unsafe",
    "electrical hazard", "electrical danger", "shock from the outlet",
    "electrical wires exposed", "unsafe wiring", "gutted and dangerous",
]

MEDIUM = [
    "dripping tap", "leak under the sink", "small leak", "slow drain",
    "clogged drain", "toilet clogged", "thermostat not working",
    "not cooling", "not heating", "inefficient heating", "noisy unit",
    "mold on the wall", "water stain on the ceiling", "flickering light",
    "light not working", "not working", "damaged", "cracked tile",
    "crack in the wall", "maintenance required", "stained carpet",
]

LOW = [
    "routine check", "annual inspection", "scheduled maintenance",
    "minor cosmetic issue", "paint peeling", "tiny crack in the paint",
    "booking an appointment", "general enquiry", "scheduling a service",
    "seeking a quote", "cosmetic touch up", "lightbulb needs replacing",
    "routine tune up", "preventative maintenance", "inventory check",
]

ROOMS = [
    "kitchen", "bathroom", "bedroom", "living room", "garage",
    "hallway", "balcony", "laundry room", "lobby", "store room",
    "unit 12", "unit 8", "block A", "block B", "apartment 5",
]

PHRASE_OPENERS = [
    "There is {kw} {loc}.",
    "We have a problem: {kw} {loc}.",
    "Tenant reports {kw} {loc}.",
    "Please attend to {kw} {loc}.",
    "Noticed {kw} in the {room}.",
    "Complaint: {kw} {loc}.",
    "Need help with {kw} {loc}.",
    "{kw} has been going on {loc}.",
    "Reporting {kw} from {loc}.",
    "There is an issue with {kw} {loc}.",
]

LOCATOR = ["in the unit", "near the entrance", "on the third floor", "by the stairs"]


def _sample_text(rng, priority):
    op = rng.choice(PHRASE_OPENERS)
    room = rng.choice(ROOMS)
    loc = (rng.choice(LOCATOR) if rng.random() < 0.5 else f"in the {room}")
    kw = rng.choice(priority)
    kw = kw.replace(" the unit", "").replace(" in the unit", "")
    return op.format(kw=kw, room=room, loc=loc)


def generate_priority_dataset(total: int = 1500, seed: int = 7) -> list[dict]:
    rng = random.Random(seed)
    # Rough distribution tuned so EMERGENCY/HIGH are important but not dominant,
    # ensuring the model sees enough examples of each class.
    weights = {"LOW": 25, "MEDIUM": 30, "HIGH": 25, "EMERGENCY": 20}
    pool = [k for k, w in weights.items() for _ in range(w)]

    rows = []
    for _ in range(total):
        priority = rng.choice(pool)
        rows.append({"text": _sample_text(rng, globals()[priority]), "priority": priority})

    rng.shuffle(rows)
    return rows


def write_priority_dataset(path: Path, total: int = 1500, seed: int = 7) -> list[dict]:
    rows = generate_priority_dataset(total, seed)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["text", "priority"])
        writer.writeheader()
        writer.writerows(rows)
    return rows


if __name__ == "__main__":
    out = Path(__file__).resolve().parent / "priority_training_data.csv"
    rows = write_priority_dataset(out)
    print(f"Wrote {len(rows)} labelled samples -> {out}")
    from collections import Counter
    print(Counter(r["priority"] for r in rows))
