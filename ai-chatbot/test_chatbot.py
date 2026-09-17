"""Unit tests for the SPMT tenant AI chatbot (uses the Python standard library)."""

import os
import unittest

from chatbot import TenantChatbot
from kb_loader import load_kb

KB = os.path.join(os.path.dirname(__file__), "knowledge_base.md")


class TestKbLoader(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.entries = load_kb(KB)

    def test_parses_entries(self):
        self.assertGreaterEqual(len(self.entries), 20)

    def test_no_empty_answers(self):
        for entry in self.entries:
            self.assertTrue(entry.answer.strip(), f"Empty answer for: {entry.question}")

    def test_sections_captured(self):
        sections = {e.section for e in self.entries}
        self.assertIn("Creating a Ticket (Reporting a Problem)", sections)
        self.assertIn("Tracking Your Ticket", sections)

    def test_known_question_present(self):
        questions = " ".join(e.question.lower() for e in self.entries)
        self.assertIn("how do i create a ticket", questions)


class TestChatbot(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.bot = TenantChatbot(KB)

    def test_greeting(self):
        self.assertEqual(self.bot.reply("hi")["source"], "greeting")

    def test_how_to_report_issue(self):
        reply = self.bot.reply("how do I report a problem or create a ticket?")
        self.assertIn("Submit a Ticket", reply["answer"])
        self.assertTrue(reply["confident"])

    def test_emergency_detection(self):
        reply = self.bot.reply("what happens if there is a gas leak or flooding?")
        self.assertIn("emergency", reply["answer"].lower())

    def test_ticket_status_meaning(self):
        reply = self.bot.reply("what does it mean when my ticket is accepted?")
        self.assertIn("confirmed they'll do the job", reply["answer"])

    def test_rating_question(self):
        reply = self.bot.reply("how can I rate the provider?")
        self.assertIn("rating", reply["answer"].lower())

    def test_password_reset(self):
        reply = self.bot.reply("I forgot my password")
        self.assertIn("Forgot Password", reply["answer"])

    def test_fallback_on_gibberish(self):
        reply = self.bot.reply("zxqvbnqw pzodksld")
        self.assertEqual(reply["confidence"], 0.0)
        self.assertIn("Try asking about topics", reply["answer"])

    def test_topics_listed(self):
        self.assertTrue(self.bot.topics)
        self.assertIn("Safety", self.bot.topics)


class TestRoleScoping(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.bot = TenantChatbot(KB)

    def test_role_topics_filtered(self):
        topics = self.bot.topics_for("PROPERTY_MANAGER")
        self.assertIn("Property Manager Guide", topics)
        self.assertNotIn("Creating a Ticket (Reporting a Problem)", topics)

    def test_tenant_topics_relevant(self):
        topics = self.bot.topics_for("TENANT")
        self.assertIn("Creating a Ticket (Reporting a Problem)", topics)
        self.assertNotIn("System Administrator Guide", topics)

    def test_manager_question_answered(self):
        reply = self.bot.reply("how do I approve a new tenant account?", "PROPERTY_MANAGER")
        self.assertTrue(reply["confident"])
        self.assertIn("approve", reply["answer"].lower())

    def test_provider_question_answered(self):
        reply = self.bot.reply("how do I update the status of my job?", "SERVICE_PROVIDER")
        self.assertTrue(reply["confident"])
        self.assertIn("status", reply["answer"].lower())

    def test_admin_question_answered(self):
        reply = self.bot.reply("how do I manage users?", "SYSTEM_ADMIN")
        self.assertTrue(reply["confident"])
        self.assertIn("Users", reply["answer"])

    def test_role_greeting(self):
        reply = self.bot.reply("hi", "SERVICE_PROVIDER")
        self.assertEqual(reply["source"], "greeting")
        self.assertIn("jobs", reply["answer"].lower())

    def test_unscoped_role_falls_back_to_all(self):
        topics = self.bot.topics_for("UNKNOWN_ROLE")
        self.assertGreaterEqual(len(topics), 1)


if __name__ == "__main__":
    unittest.main(verbosity=2)
