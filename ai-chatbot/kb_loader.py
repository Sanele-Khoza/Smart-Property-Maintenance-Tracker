"""Load and parse the SPMT tenant knowledge base into Q&A entries.

The knowledge base is a markdown file with ``##`` section headings and
``**Q:**`` question lines. Everything between a question line and the next
question/section heading is treated as that question's answer.
"""

import re
from dataclasses import dataclass


@dataclass
class QAEntry:
    question: str
    answer: str
    section: str


def load_kb(path: str) -> list[QAEntry]:
    """Parse a markdown knowledge base into a list of QAEntry objects."""
    with open(path, encoding="utf-8") as f:
        raw = f.read()

    entries: list[QAEntry] = []
    section = "General"
    started = False
    section_intro: list[str] = []
    current_q: str | None = None
    current_lines: list[str] = []

    def flush_intro() -> None:
        nonlocal section_intro
        if section_intro:
            answer = " ".join(section_intro).strip()
            if answer:
                entries.append(QAEntry(question=section, answer=answer, section=section))
        section_intro = []

    def flush() -> None:
        nonlocal current_q, current_lines
        if current_q is not None:
            answer = " ".join(current_lines).strip()
            entries.append(QAEntry(question=current_q, answer=answer, section=section))
        current_q = None
        current_lines = []

    for line in raw.splitlines():
        stripped = line.strip()
        if not stripped or stripped == "---":
            continue
        if stripped.startswith("## "):
            started = True
            flush()
            flush_intro()
            section = re.sub(r"^\d+\.\s*", "", stripped[3:].strip())
            continue
        if not started:
            continue
        q_match = re.match(r"^\*\*Q:\s*(.*?)\s*\*\*$", stripped)
        if q_match:
            flush()
            section_intro = []
            current_q = q_match.group(1).strip()
            continue
        if current_q is not None:
            current_lines.append(stripped)
        else:
            section_intro.append(stripped)

    flush()
    flush_intro()
    return entries
