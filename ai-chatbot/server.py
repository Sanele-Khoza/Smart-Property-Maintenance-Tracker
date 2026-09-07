"""Zero-dependency HTTP server for the SPMT tenant AI chatbot.

Serves the chat UI at ``/`` and the JSON API at ``POST /api/chat``.

Run:
    python server.py                 # http://localhost:8090
    python server.py --port 9000
    python server.py --kb path/to/kb.md
"""

import argparse
import json
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

from chatbot import TenantChatbot

STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
INDEX_HTML = os.path.join(STATIC_DIR, "index.html")


def build_handler(chatbot: TenantChatbot) -> type[BaseHTTPRequestHandler]:
    class ChatHandler(BaseHTTPRequestHandler):
        server_version = "SPMTChatbot/1.0"

        def log_message(self, fmt, *args):  # quieter logging
            sys.stderr.write("%s - - [%s] %s\n" % (self.address_string(), self.log_date_time_string(), fmt % args))

        def _send_json(self, payload: dict, status: int = 200) -> None:
            body = json.dumps(payload).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            if urlparse(self.path).path == "/" or self.path.startswith("/index.html"):
                try:
                    with open(INDEX_HTML, "rb") as f:
                        body = f.read()
                except OSError:
                    self._send_json({"error": "index.html missing"}, status=500)
                    return
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            if self.path.startswith("/health"):
                self._send_json({"status": "ok", "entries": len(chatbot.entries), "topics": len(chatbot.topics)})
                return
            self._send_json({"error": "Not found"}, status=404)

        def do_POST(self):
            if urlparse(self.path).path != "/api/chat":
                self._send_json({"error": "Not found"}, status=404)
                return
            try:
                length = int(self.headers.get("Content-Length") or 0)
                raw = self.rfile.read(length) if length else b"{}"
                data = json.loads(raw.decode("utf-8")) if raw else {}
                message = data.get("message") or data.get("question") or ""
            except (json.JSONDecodeError, UnicodeDecodeError):
                self._send_json({"error": "Invalid JSON body"}, status=400)
                return

            if not isinstance(message, str) or not message.strip():
                self._send_json({"error": "Missing 'message' field"}, status=400)
                return

            reply = chatbot.reply(message)
            reply["asked"] = message.strip()
            self._send_json({"success": True, "data": reply})

    return ChatHandler


def main() -> None:
    parser = argparse.ArgumentParser(description="SPMT tenant AI chatbot")
    parser.add_argument("--port", type=int, default=int(os.environ.get("SPMT_CHAT_PORT", "8090")))
    parser.add_argument("--host", default=os.environ.get("SPMT_CHAT_HOST", "127.0.0.1"))
    parser.add_argument("--kb", default=None, help="Path to the knowledge base markdown file")
    args = parser.parse_args()

    chatbot = TenantChatbot(args.kb)
    print(f"[SPMT chatbot] Loaded {len(chatbot.entries)} Q&A entries from {chatbot.kb_path}")
    print(f"[SPMT chatbot] Serving UI at http://{args.host}:{args.port}/  (API: POST /api/chat)")

    httpd = ThreadingHTTPServer((args.host, args.port), build_handler(chatbot))
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[SPMT chatbot] Shutting down.")
        httpd.shutdown()


if __name__ == "__main__":
    main()
