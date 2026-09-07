# SPMT Tenant AI Chatbot

A standalone, zero-dependency Python chatbot that answers tenant questions about the
**Smart Property Maintenance Tracker (SPMT)** app using the
`SPMT_Tenant_AI_Knowledge_Base.md` document as its knowledge source.

Built for Python 3.10+ using **only the standard library** — no `pip install` needed.

## Quick start

```bash
# 1. Web UI + API server (http://localhost:8090)
python server.py

# 2. Or chat from the terminal
python cli.py

# 3. Run the tests
python -m unittest test_chatbot
```

Open http://localhost:8090 in a browser to use the chat interface.

## Options

```bash
python server.py --port 9000      # different port (env: SPMT_CHAT_PORT)
python server.py --host 0.0.0.0   # listen on all interfaces (env: SPMT_CHAT_HOST)
python server.py --kb path/to/kb.md   # use a different knowledge base
python cli.py --kb path/to/kb.md
```

## Project layout

```
ai-chatbot/
├── server.py          # HTTP server: chat UI + POST /api/chat
├── cli.py             # terminal chat
├── chatbot.py         # retrieval logic (TenantChatbot class)
├── matcher.py         # tokenization, TF-IDF, synonyms, bigram matching
├── kb_loader.py       # parses the markdown knowledge base into Q&A entries
├── knowledge_base.md  # the SPMT tenant help guide (the KB)
├── test_chatbot.py    # unit tests
└── static/
    └── index.html     # the web chat UI
```

## How it works

1. **KB parsing** — `kb_loader.py` reads the markdown and splits it into Q&A
   entries: one per `**Q:**` line, plus section intro text (e.g. the "What is
   SPMT?" overview) as a searchable entry.
2. **Scoring** — `matcher.py` scores each entry against the user's question
   using:
   - TF-IDF cosine similarity against the entry's question text,
   - TF-IDF cosine similarity against the entry's answer text,
   - bigram overlap for phrase-level matches.
3. **Synonyms** — a small domain dictionary (`report` → `submit`/`create`,
   `leaking pipe` → `plumbing`, etc.) expands both sides, with real words
   weighted higher than synonyms to avoid false matches.
4. **Confidence** — confident answers are returned as-is; borderline answers
   are still returned but flagged; anything too weak triggers a fallback that
   lists the available help topics.

## API

### `POST /api/chat`

Request:

```json
{ "message": "I forgot my password" }
```

Response:

```json
{
  "success": true,
  "data": {
    "asked": "I forgot my password",
    "answer": "Use the \"Forgot Password\" link on the login screen. ...",
    "confidence": 0.775,
    "confident": true,
    "source": "Getting Started — Account & Login",
    "matched_question": "I forgot my password. What do I do?",
    "topics": ["Getting Started — Account & Login", "..."]
  }
}
```

### `GET /health`

Returns `{ "status": "ok", "entries": 29, "topics": 10 }`.

## Adding knowledge

Edit `knowledge_base.md` (or supply your own with `--kb`). New sections use
the same format:

```markdown
## My New Topic

**Q: A tenant question?**
The answer text goes here.
```

Restart the server and the new content is picked up automatically.
