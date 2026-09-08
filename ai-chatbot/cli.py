"""Terminal chat with the SPMT AI chatbot.

Run:
    python cli.py
    python cli.py --kb path/to/kb.md
    python cli.py --role PROPERTY_MANAGER
"""

import argparse
import os

from chatbot import TenantChatbot, ROLES

HELP_TEXT = (
    "Commands: 'exit' or 'quit' to leave, 'topics' to list help topics, "
    "'role <ROLE>' to switch role, 'help' for this message."
)


def main() -> None:
    parser = argparse.ArgumentParser(description="SPMT AI chatbot (terminal)")
    parser.add_argument("--kb", default=None, help="Path to the knowledge base markdown file")
    parser.add_argument("--role", default=None, help="Initial role (TENANT, PROPERTY_MANAGER, SERVICE_PROVIDER, SYSTEM_ADMIN)")
    args = parser.parse_args()

    chatbot = TenantChatbot(args.kb)
    role = args.role.upper() if args.role and args.role.upper() in ROLES else None
    print(f"[SPMT chatbot] Loaded {len(chatbot.entries)} Q&A entries from {chatbot.kb_path}")
    print(f"[SPMT chatbot] Role: {role or 'all roles'} ({HELP_TEXT})\n")

    while True:
        try:
            message = input("You: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\n[SPMT chatbot] Bye!")
            break

        if not message:
            continue
        lower = message.lower()
        if lower in ("exit", "quit"):
            print("[SPMT chatbot] Bye!")
            break
        if lower == "help":
            print(f"[SPMT chatbot] {HELP_TEXT}")
            continue
        if lower == "topics":
            print("[SPMT chatbot] Available topics:")
            for topic in chatbot.topics_for(role):
                print(f"  - {topic}")
            continue
        if lower.startswith("role "):
            candidate = lower.split()[1].upper()
            if candidate in ROLES:
                role = candidate
                print(f"[SPMT chatbot] Switched role to {role}")
            else:
                print(f"[SPMT chatbot] Unknown role: {candidate}")
            continue

        reply = chatbot.reply(message, role)
        print(f"[SPMT chatbot] {reply['answer']}")
        if reply.get("source") and reply["source"] != "greeting":
            print(f"[SPMT chatbot] (Source: {reply['source']} — confidence {reply['confidence']})")
        print()


if __name__ == "__main__":
    main()
