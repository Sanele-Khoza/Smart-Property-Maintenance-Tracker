import React, { useState } from 'react';
import { FaRobot } from 'react-icons/fa';
import ChatAssistant from './ChatAssistant';

const AiAssistantWidget = () => {
  const [open, setOpen] = useState(false);

  const close = () => setOpen(false);

  return (
    <>
      {open && <div className="ai-widget-overlay" onClick={close} />}
      <div className={`ai-widget-panel ${open ? 'ai-widget-panel-open' : ''}`} aria-hidden={!open}>
        {open && <ChatAssistant compact onClose={close} />}
      </div>
      <button
        className={`ai-fab ${open ? 'ai-fab-open' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-label="AI Assistant"
        title="AI Assistant"
      >
        <FaRobot />
      </button>
    </>
  );
};

export default AiAssistantWidget;