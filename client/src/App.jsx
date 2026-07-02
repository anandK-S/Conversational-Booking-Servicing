import React, { useEffect, useRef, useState } from 'react';
import { Send, Plane } from 'lucide-react';
import './App.css';
import { FlightStatusCard, BoardingPassCard, CancellationCard, SeatMapPreview, AgentHandoffBanner } from './components/TicketWidgets';

const API_BASE = import.meta.env.VITE_API_BASE || '';

function Bubble({ from, text }) {
  const html = text
    .split('\n')
    .map((line) => line.replace(/\*(.+?)\*/g, '<strong>$1</strong>'))
    .join('\n');
  return (
    <div className={`msg-row msg-row--${from}`}>
      <div
        className={`bubble bubble--${from}`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

function Widget({ widget, onSeatPick }) {
  if (!widget) return null;
  switch (widget.type) {
    case 'flight_status':
      return <div className="widget-row"><FlightStatusCard data={widget.data} /></div>;
    case 'boarding_pass':
      return <div className="widget-row"><BoardingPassCard data={widget.data} /></div>;
    case 'cancellation':
      return <div className="widget-row"><CancellationCard data={widget.data} /></div>;
    case 'seat_map':
      return <div className="widget-row"><SeatMapPreview data={widget.data} onPick={onSeatPick} /></div>;
    default:
      return null;
  }
}

export default function App() {
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [handoff, setHandoff] = useState(false);
  const bodyRef = useRef(null);

  useEffect(() => {
    async function init() {
      const res = await fetch(`${API_BASE}/api/session`, { method: 'POST' });
      const data = await res.json();
      setSessionId(data.sessionId);
      setMessages([
        {
          from: 'bot',
          text:
            "👋 Welcome to BlueWings! I'm your virtual assistant — I can help with check-in, seat selection, flight status, baggage, and cancellations.\n\nTo get started, please share your *PNR* and *last name*.",
        },
      ]);
    }
    init();
  }, []);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages, typing]);

  async function send(text) {
    if (!text.trim() || !sessionId) return;
    setMessages((m) => [...m, { from: 'user', text }]);
    setInput('');
    setTyping(true);
    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message: text }),
      });
      const data = await res.json();
      await new Promise((r) => setTimeout(r, 400));
      setMessages((m) => [
        ...m,
        { from: 'bot', text: data.text, quickReplies: data.quickReplies, widget: data.widget },
      ]);
      if (data.handoff) setHandoff(true);
    } catch (e) {
      setMessages((m) => [...m, { from: 'bot', text: 'Sorry, something went wrong. Please try again.' }]);
    } finally {
      setTyping(false);
    }
  }

  function handleSeatPick(seatId) {
    send(`seat_${seatId}`);
  }

  return (
    <div className="app">
      <div className="phone">
        <div className="chat-header">
          <div className="chat-header__logo"><Plane size={20} /></div>
          <div>
            <div className="chat-header__title">BlueWings Assistant</div>
            <div className="chat-header__subtitle"><span className="status-dot" />Online · replies instantly</div>
          </div>
        </div>

        <div className="chat-body" ref={bodyRef}>
          {messages.map((m, i) => (
            <React.Fragment key={i}>
              <Bubble from={m.from} text={m.text} />
              {m.widget && <Widget widget={m.widget} onSeatPick={handleSeatPick} />}
              {i === messages.length - 1 && m.quickReplies && m.quickReplies.length > 0 && !typing && (
                <div className="quick-replies">
                  {m.quickReplies.map((qr) => (
                    <button key={qr.id} className="quick-reply" onClick={() => send(qr.id)}>
                      {qr.label}
                    </button>
                  ))}
                </div>
              )}
            </React.Fragment>
          ))}
          {typing && (
            <div className="msg-row msg-row--bot">
              <div className="typing-indicator"><span /><span /><span /></div>
            </div>
          )}
          {handoff && <AgentHandoffBanner />}
        </div>

        <div className="demo-hint">
          Try PNR <code>BW7X9K</code> / last name <code>Sharma</code>
        </div>

        <form
          className="chat-input"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message…"
            disabled={!sessionId}
          />
          <button type="submit" disabled={!input.trim()}>
            <Send size={17} />
          </button>
        </form>
      </div>
    </div>
  );
}
