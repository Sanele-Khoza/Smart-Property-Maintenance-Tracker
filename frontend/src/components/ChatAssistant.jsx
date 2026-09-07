import React, { useState, useEffect, useRef } from 'react';
import { FaRobot, FaPaperPlane, FaSpinner } from 'react-icons/fa';
import Alert from '../components/common/Alert';
import { sendChatMessage, getChatbotHealth } from '../data/chatbotStore';

const SUGGESTIONS = [
  'How do I create a ticket?',
  'What does each ticket status mean?',
  'Why can\'t I log in after registering?',
  'How is an emergency detected?',
  'How do I rate a service provider?',
  'Is my personal information safe?',
];

const ChatAssistant = ({ title = 'AI Assistant', subtitle = 'Ask anything about reporting issues, tracking tickets, or using SPMT.' }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState(SUGGESTIONS);
  const [busy, setBusy] = useState(false);
  const [alert, setAlert] = useState({ msg: '', type: '' });
  const [online, setOnline] = useState(null);
  const listRef = useRef(null);

  useEffect(() => {
    getChatbotHealth().then(r => setOnline(r.success && r.data?.status === 'ok'));
  }, []);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, busy]);

  const add = (text, who, meta) => setMessages(prev => [...prev, { text, who, meta }]);

  const ask = async (raw) => {
    const text = String(raw || '').trim();
    if (!text || busy) return;
    add(text, 'user');
    setInput('');
    setSuggestions([]);
    setBusy(true);
    const result = await sendChatMessage(text);
    if (result.success && result.data) {
      const d = result.data;
      let meta = [];
      if (d.source && d.source !== 'greeting') meta.push(`Source: ${d.source}`);
      if (d.matched_question) meta.push(`Matched: "${d.matched_question}"`);
      if (typeof d.confidence === 'number' && d.confidence > 0) meta.push(`${Math.round(d.confidence * 100)}% match`);
      add(d.answer || 'Sorry, I could not find an answer.', 'bot', meta);
      if (Array.isArray(d.topics) && d.topics.length) setSuggestions(d.topics.slice(0, 6));
    } else {
      add(result.error || 'Sorry, I hit an error. Please try again.', 'bot');
      setOnline(false);
    }
    setBusy(false);
  };

  const onSubmit = (e) => { e.preventDefault(); ask(input); };

  return (
    <div className="card">
      <div className="card-title">
        <span><FaRobot /> {title} <span className="req-ref">AI Chatbot</span></span>
        <span style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 6, color: online === false ? 'var(--danger)' : 'var(--teal)' }}>
          {online === null && <><FaSpinner style={{ animation: 'spin 1s linear infinite' }} /> Checking…</>}
          {online === true && '● AI Assistant online'}
          {online === false && '● AI Assistant offline'}
        </span>
      </div>
      <Alert msg={alert.msg} type={alert.type} />
      <p style={{ color: 'var(--text-dim)', fontSize: 12, marginBottom: 12 }}>{subtitle}</p>

      <div
        ref={listRef}
        style={{
          display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto',
          padding: 14, background: 'var(--surface2)', borderRadius: 8,
          border: '1px solid var(--border)', minHeight: 380, maxHeight: 'calc(100vh - 340px)',
        }}
      >
        {messages.length === 0 && (
          <div style={{ color: 'var(--text-dim)', fontSize: 13, lineHeight: 1.7 }}>
            Hello! I'm the SPMT assistant.
            Ask me anything about reporting a maintenance issue, tracking your ticket,
            or using the app. Try one of the suggestions below.
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.who === 'user' ? 'flex-end' : 'flex-start' }}>
            <div
              style={{
                maxWidth: '82%', padding: '9px 13px', borderRadius: 12, fontSize: 13, lineHeight: 1.55,
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                background: m.who === 'user' ? 'rgba(45,183,145,0.18)' : 'var(--surface)',
                border: m.who === 'user' ? 'none' : '1px solid var(--border)',
              }}
            >
              {m.text}
              {m.meta && m.meta.length > 0 && (
                <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 6, fontFamily: 'var(--font-mono)' }}>
                  {m.meta.join(' · ')}
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-dim)', fontSize: 12 }}>
            <FaSpinner style={{ animation: 'spin 1s linear infinite', color: 'var(--teal)' }} /> Retrieving info...
          </div>
        )}
      </div>

      {suggestions.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '12px 0' }}>
          {suggestions.map((s, i) => (
            <button
              key={i}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: 11 }}
              onClick={() => ask(s)}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={onSubmit} style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
        <input
          className="form-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask about reporting an issue, tracking a ticket, accounts..."
          autoComplete="off"
        />
        <button className="btn btn-teal" type="submit" disabled={!input.trim() || busy}>
          <FaPaperPlane /> Send
        </button>
      </form>
    </div>
  );
};

export default ChatAssistant;