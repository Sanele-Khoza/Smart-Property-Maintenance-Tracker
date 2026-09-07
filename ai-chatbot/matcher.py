"""Pure-Python retrieval scoring (TF-IDF cosine + bigram overlap).

No external dependencies: only the Python standard library is used.
"""

import math
import re
import string
from collections import Counter

STOPWORDS = set(
    """a an and are as at be but by can did do does for from had has have how
    i if in into is it its me my no not of on or our so that the their them
    they this to us was we what when where which who will with would you your
    about because could should""".split()
)

_PUNCT_RE = re.compile(r"[%s]" % re.escape(string.punctuation))

# Domain synonyms: a tenant asks in everyday words; the KB uses app terms.
SYNONYMS = {
    "report": ["report", "submit", "create", "log", "raise"],
    "submit": ["submit", "create", "report", "log"],
    "create": ["create", "submit", "report", "raise", "log"],
    "issue": ["issue", "problem", "ticket", "fault"],
    "problem": ["problem", "issue", "ticket", "fault"],
    "ticket": ["ticket", "issue", "problem", "job"],
    "job": ["job", "ticket", "task"],
    "fix": ["fix", "repair", "service", "resolve"],
    "repair": ["repair", "fix", "service"],
    "broken": ["broken", "faulty", "fault", "damaged"],
    "faulty": ["faulty", "broken", "fault"],
    "leaking": ["leaking", "leak", "pipe", "water", "plumbing"],
    "leak": ["leak", "leaking", "pipe", "water", "plumbing"],
    "pipe": ["pipe", "plumbing", "leak", "leaking"],
    "water": ["water", "leak", "leaking", "flood", "flooding"],
    "flood": ["flood", "flooding", "water"],
    "flooding": ["flooding", "flood", "water"],
    "electric": ["electric", "electrical", "wiring", "electricity"],
    "electrical": ["electrical", "electric", "wiring", "electricity"],
    "light": ["light", "lighting", "bulb"],
    "air": ["air", "aircon", "airconditioning", "hvac", "cooling"],
    "heat": ["heat", "heating", "hvac"],
    "password": ["password", "login", "sign"],
    "login": ["login", "log", "sign", "signin", "password"],
    "forgot": ["forgot", "forgotten", "reset", "remember"],
    "reset": ["reset", "forgot", "forgotten"],
    "status": ["status", "state", "track", "progress"],
    "track": ["track", "status", "progress", "check"],
    "check": ["check", "track", "status", "view", "see"],
    "see": ["see", "view", "check", "look"],
    "look": ["look", "see", "view"],
    "photo": ["photo", "photo", "image", "picture", "attachment"],
    "image": ["image", "photo", "picture", "attachment"],
    "picture": ["picture", "photo", "image"],
    "rate": ["rate", "rating", "review", "star"],
    "rating": ["rating", "rate", "review", "star"],
    "review": ["review", "rate", "rating"],
    "notify": ["notify", "notification", "alert", "message"],
    "notification": ["notification", "notify", "alert", "message"],
    "alert": ["alert", "notification", "notify"],
    "provider": ["provider", "technician", "contractor", "repairman", "plumber"],
    "technician": ["technician", "provider", "contractor"],
    "plumber": ["plumber", "plumbing", "pipe"],
    "emergency": ["emergency", "urgent", "danger", "critical"],
    "urgent": ["urgent", "emergency", "critical"],
    "safe": ["safe", "security", "privacy", "protected"],
    "security": ["security", "safe", "private", "privacy"],
    "privacy": ["privacy", "private", "personal", "data"],
    "account": ["account", "profile", "register", "signup"],
    "register": ["register", "signup", "create", "account"],
    "lock": ["lock", "locked", "blocked"],
    "locked": ["locked", "lock", "blocked"],
}


def expand(tokens: list[str]) -> list[str]:
    """Expand tokens with domain synonyms to improve recall."""
    out: list[str] = []
    for token in tokens:
        out.extend(SYNONYMS.get(token, [token]))
    return out


SYNONYM_WEIGHT = 0.35


def expand_weighted(tokens: list[str]) -> Counter:
    """Token weights: original tokens count 1.0, synonyms count 0.35.

    Using weights instead of duplicating tokens prevents synonym bloat from
    drowning out genuine matches.
    """
    out: Counter = Counter()
    for token in tokens:
        out[token] += 1.0
        for synonym in SYNONYMS.get(token, ()):
            if synonym != token:
                out[synonym] += SYNONYM_WEIGHT
    return out


def tokenize(text: str) -> list[str]:
    """Lowercase, strip punctuation, and split into non-stopword tokens."""
    text = text.lower()
    text = _PUNCT_RE.sub(" ", text)
    return [t for t in text.split() if t and t not in STOPWORDS]


def _tf(tokens: list[str]) -> Counter:
    return Counter(tokens)


def _idf(tokens_by_entry: list[list[str]]) -> dict[str, float]:
    n = len(tokens_by_entry)
    df: Counter = Counter()
    for tokens in tokens_by_entry:
        for token in set(tokens):
            df[token] += 1
    return {token: math.log((1 + n) / (1 + count)) + 1 for token, count in df.items()}


def cosine(q_tf: Counter, d_tf: Counter, idf: dict[str, float]) -> float:
    qv = {t: q_tf.get(t, 0) * idf.get(t, 0) for t in q_tf}
    dv = {t: d_tf.get(t, 0) * idf.get(t, 0) for t in d_tf}
    dot = sum(qv.get(t, 0) * dv.get(t, 0) for t in qv)
    qn = math.sqrt(sum(v * v for v in qv.values()))
    dn = math.sqrt(sum(v * v for v in dv.values()))
    if qn == 0 or dn == 0:
        return 0.0
    return dot / (qn * dn)


def bigram_overlap(q_tokens: list[str], d_tokens: list[str]) -> float:
    """Fraction of question bigrams present in the document bigrams."""
    q_bigrams = set(zip(q_tokens, q_tokens[1:])) if len(q_tokens) > 1 else set()
    d_bigrams = set(zip(d_tokens, d_tokens[1:]))
    if not q_bigrams:
        return 0.0
    return len(q_bigrams & d_bigrams) / len(q_bigrams)
