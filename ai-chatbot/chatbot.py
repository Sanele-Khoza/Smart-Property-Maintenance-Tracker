"""SPMT AI chatbot — retrieval-based Q&A over the knowledge base.

The chatbot is role-aware: every request can pass the caller's role
(TENANT, PROPERTY_MANAGER, SERVICE_PROVIDER, SYSTEM_ADMIN) and only matches
Q&A entries scoped to that role (sections without a role tag match everyone).
"""

import os
from typing import Any

from kb_loader import load_kb, QAEntry, entry_matches
from matcher import tokenize, expand_weighted, _tf, _idf, cosine, bigram_overlap

DEFAULT_KB = os.path.join(os.path.dirname(__file__), "knowledge_base.md")

ROLES = ("TENANT", "PROPERTY_MANAGER", "SERVICE_PROVIDER", "SYSTEM_ADMIN")

GREETINGS = {
    "hi": "Hello! I'm the SPMT assistant. I can help you with the features available to you in your role. What do you need help with?",
    "hello": "Hello! I'm the SPMT assistant. I can help you with the features available to you in your role. What do you need help with?",
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

ROLE_GREETINGS = {
    "TENANT": "Hello, tenant! I can help you report a maintenance issue, track a ticket, rate a provider, or understand your account. What do you need?",
    "PROPERTY_MANAGER": "Hello, manager! I can help you approve tenants, manage properties and units, assign and escalate tickets, and run reports. What do you need?",
    "SERVICE_PROVIDER": "Hello! I can help you manage your jobs, update ticket statuses, handle scheduling and emergencies, and check your performance. What do you need?",
    "SYSTEM_ADMIN": "Hello, administrator! I can help you manage users, properties, technicians, settings, backups, analytics, and system health. What do you need?",
}

INTRO_GREETINGS = {"hi", "hello", "hey"}

CONFIDENT_THRESHOLD = 0.18
TENTATIVE_THRESHOLD = 0.08

FALLBACK = (
    "I'm not sure I understood that. Try asking about topics like:\n\n"
    + "{}"
    + "\n\nOr try rephrasing your question."
)


def _is_intro_greeting(key: str, greeting: str) -> bool:
    return key.strip("!.? ").lower() in INTRO_GREETINGS


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

    def topics_for(self, role: str | None) -> list[str]:
        seen: list[str] = []
        for e in self.entries:
            if e.section not in seen and (e.roles is None or (role is not None and entry_matches(e, role))):
                seen.append(e.section)
        return seen

    def _entries_for(self, role: str | None) -> list[int]:
        if role is None:
            return list(range(len(self.entries)))
        return [i for i, e in enumerate(self.entries) if entry_matches(e, role)]

    def reply(self, message: str, role: str | None = None) -> dict[str, Any]:
        question = (message or "").strip()
        if role and role.upper() in ROLES:
            role = role.upper()
        else:
            role = None

        if not question:
            return _fallback(self.topics_for(role))

        greeting = self._match_greeting(question, role)
        if greeting:
            return {
                "answer": greeting,
                "confidence": 1.0,
                "source": "greeting",
                "matched_question": None,
                "topics": self.topics_for(role),
            }

        q_raw = tokenize(question)
        if not q_raw:
            return _fallback(self.topics_for(role))

        q_tokens = expand_weighted(q_raw)

        best_score = 0.0
        best_index = -1
        for i in self._entries_for(role):
            entry = self.entries[i]
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
            return _fallback(self.topics_for(role))

        entry = self.entries[best_index]
        return {
            "answer": entry.answer,
            "confidence": round(min(best_score, 1.0), 3),
            "source": entry.section,
            "matched_question": entry.question,
            "topics": self.topics_for(role),
            "confident": best_score >= CONFIDENT_THRESHOLD,
            "role": role,
        }

    @staticmethod
    def _match_greeting(question: str, role: str | None) -> str | None:
        cleaned = question.lower().strip("!.? ")
        if cleaned in GREETINGS:
            greeting = GREETINGS[cleaned]
            if role and _is_intro_greeting(cleaned, greeting):
                return ROLE_GREETINGS.get(role, greeting)
            return greeting
        first = cleaned.split()[0] if cleaned.split() else ""
        if first in GREETINGS:
            greeting = GREETINGS[first]
            if role and _is_intro_greeting(first, greeting):
                return ROLE_GREETINGS.get(role, greeting)
            return greeting
        return None