"""SPMT tenant AI chatbot — retrieval-based Q&A over the knowledge base."""

import os
from typing import Any

from kb_loader import load_kb, QAEntry
from matcher import tokenize, expand_weighted, _tf, _idf, cosine, bigram_overlap

DEFAULT_KB = os.path.join(os.path.dirname(__file__), "knowledge_base.md")

GREETINGS = {
    "hi": "Hello! I'm the SPMT assistant. I can help with things like reporting a maintenance issue, tracking a ticket, or understanding your account. What do you need help with?",
    "hello": "Hello! I'm the SPMT assistant. I can help with things like reporting a maintenance issue, tracking a ticket, or understanding your account. What do you need help with?",
    "hey": "Hey there! How can I help you with SPMT today?",
    "good morning": "Good morning! How can I help you with SPMT today?",
    "good afternoon": "Good afternoon! How can I help you with SPMT today?",
    "good evening": "Good evening! How can I help you with SPMT today?",
    "thanks": "You're welcome! If you need anything else about SPMT, just ask.",
    "thank you": "You're welcome! If you need anything else about SPMT, just ask.",
    "thanks for the help": "You're welcome! If you need anything else about SPMT, just ask.",
    "bye": "Goodbye! Feel free to come back if you have more questions about SPMT.",
    "goodbye": "Goodbye! Feel free to come back if you have more questions about SPMT.",
}

CONFIDENT_THRESHOLD = 0.18
TENTATIVE_THRESHOLD = 0.08

FALLBACK = (
    "I'm not sure I understood that. Try asking about topics like:\n\n"
    + "{}"
    + "\n\nOr try rephrasing your question."
)


def _fallback(topics: list[str]) -> dict[str, Any]:
    bullets = "\n".join(f"• {t}" for t in topics)
    return {
        "answer": FALLBACK.format(bullets),
        "confidence": 0.0,
        "source": None,
        "matched_question": None,
        "topics": topics,
    }


class TenantChatbot:
    def __init__(self, kb_path: str | None = None):
        self.kb_path = kb_path or DEFAULT_KB
        self.entries: list[QAEntry] = load_kb(self.kb_path)
        self.entry_tokens = [tokenize(e.question + " " + e.answer) for e in self.entries]
        self.idf = _idf(self.entry_tokens)

    @property
    def topics(self) -> list[str]:
        seen: list[str] = []
        for e in self.entries:
            if e.section not in seen:
                seen.append(e.section)
        return seen

    def reply(self, message: str) -> dict[str, Any]:
        question = (message or "").strip()
        if not question:
            return _fallback(self.topics)

        greeting = self._match_greeting(question)
        if greeting:
            return {
                "answer": greeting,
                "confidence": 1.0,
                "source": "greeting",
                "matched_question": None,
                "topics": self.topics,
            }

        q_raw = tokenize(question)
        if not q_raw:
            return _fallback(self.topics)

        q_tokens = expand_weighted(q_raw)

        best_score = 0.0
        best_index = -1
        for i, entry in enumerate(self.entries):
            q_text_raw = tokenize(entry.question)
            a_text_raw = tokenize(entry.answer)
            score = (
                0.45 * cosine(q_tokens, expand_weighted(q_text_raw), self.idf)
                + 0.35 * cosine(q_tokens, expand_weighted(a_text_raw), self.idf)
                + 0.20 * bigram_overlap(q_raw, q_text_raw + a_text_raw)
            )
            if score > best_score:
                best_score = score
                best_index = i

        if best_index == -1 or best_score < TENTATIVE_THRESHOLD:
            return _fallback(self.topics)

        entry = self.entries[best_index]
        return {
            "answer": entry.answer,
            "confidence": round(min(best_score, 1.0), 3),
            "source": entry.section,
            "matched_question": entry.question,
            "topics": self.topics,
            "confident": best_score >= CONFIDENT_THRESHOLD,
        }

    @staticmethod
    def _match_greeting(question: str) -> str | None:
        cleaned = question.lower().strip("!.? ")
        if cleaned in GREETINGS:
            return GREETINGS[cleaned]
        first = cleaned.split()[0] if cleaned.split() else ""
        if first in GREETINGS:
            return GREETINGS[first]
        return None
