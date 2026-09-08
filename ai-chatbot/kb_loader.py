"""Load and parse the SPMT knowledge base into Q&A entries.

The knowledge base is a markdown file with ``##`` section headings and
``**Q:**`` question lines. Everything between a question line and the next
question/section heading is treated as that question's answer.

Sections can be role-scoped by appending a role list in square brackets to
the heading, e.g. ``## 3. Creating a Ticket [TENANT]``. A section with no
role tag applies to every role (``roles = None``).
"""

import re
from dataclasses import dataclass, field


@dataclass
class QAEntry:
    question: str
    answer: str
    section: str
    roles: set[str] | None = field(default=None)


ROLE_TAG_RE = re.compile(r"^##\s+(.+?)\s*\[([^\]]+)\]\s*$")


def parse_roles(raw: str) -> set[str] | None:
    """Parse a comma-separated role list into a set of uppercase roles."""
    return {part.strip().upper() for part in raw.split(",") if part.strip()}


def entry_matches(entry: QAEntry, role: str | None) -> bool:
    """True when an entry should be shown/answered to the given role."""
    if entry.roles is None:
        return True
    return role in entry.roles


def load_kb(path: str) -> list[QAEntry]:
    """Parse a markdown knowledge base into a list of QAEntry objects."""
    with open(path, encoding="utf-8") as f:
        raw = f.read()

    entries: list[QAEntry] = []
    section = "General"
    started = False
    section_intro: list[str] = []
    section_roles: set[str] | None = None
    current_q: str | None = None
    current_lines: list[str] = []
    current_roles: set[str] | None = None

    def flush_intro() -> None:
        nonlocal section_intro
        if section_intro:
            answer = " ".join(section_intro).strip()
            if answer:
                entries.append(QAEntry(question=section, answer=answer, section=section, roles=section_roles))
        section_intro = []

    def flush() -> None:
        nonlocal current_q, current_lines, current_roles
        if current_q is not None:
            answer = " ".join(current_lines).strip()
            entries.append(QAEntry(question=current_q, answer=answer, section=section, roles=current_roles))
        current_q = None
        current_lines = []
        current_roles = None

    for line in raw.splitlines():
        stripped = line.strip()
        if not stripped or stripped == "---":
            continue
        if stripped.startswith("## "):
            started = True
            flush()
            flush_intro()
            tag_match = ROLE_TAG_RE.match(stripped)
            if tag_match:
                section = re.sub(r"^\d+\.\s*", "", tag_match.group(1).strip())
                section_roles = parse_roles(tag_match.group(2))
            else:
                section = re.sub(r"^\d+\.\s*", "", stripped[3:].strip())
                section_roles = None
            continue
        if not started:
            continue
        q_match = re.match(r"^\*\*Q:\s*(.*?)\s*\*\*$", stripped)
        if q_match:
            flush()
            section_intro = []
            current_q = q_match.group(1).strip()
            current_roles = section_roles
            continue
        if current_q is not None:
            current_lines.append(stripped)
        else:
            section_intro.append(stripped)

    flush()
    flush_intro()
    return entries