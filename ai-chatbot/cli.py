"""Terminal chat with the SPMT tenant AI chatbot.

Run:
    python cli.py
    python cli.py --kb path/to/kb.md
"""

import argparse
import os

from chatbot import TenantChatbot

HELP_TEXT = (
    "Commands: 'exit' or 'quit' to leave, 'topics' to list help topics, "
    "'help' for this message."
)


def main() -> None:
    parser = argparse.ArgumentParser(description="SPMT tenant AI chatbot (terminal)")
    parser.add_argument("--kb", default=None, help="Path to the knowledge base markdown file")
    args = parser.parse_args()

    chatbot = TenantChatbot(args.kb)
    print(f"[SPMT chatbot] Loaded {len(chatbot.entries)} Q&A entries from {chatbot.kb_path}")
    print(f"[SPMT chatbot] {HELP_TEXT}\n")

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
            for topic in chatbot.topics:
                print(f"  - {topic}")
            continue

        reply = chatbot.reply(message)
        print(f"[SPMT chatbot] {reply['answer']}")
        if reply.get("source") and reply["source"] != "greeting":
            print(f"[SPMT chatbot] (Source: {reply['source']} — confidence {reply['confidence']})")
        print()


if __name__ == "__main__":
    main()
