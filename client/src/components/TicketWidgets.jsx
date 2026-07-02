import React, { useState } from 'react';
import { Plane, MapPin, Luggage, XCircle, CheckCircle2, Clock } from 'lucide-react';
import './widgets.css';

function fmtTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}
function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function FlightStatusCard({ data }) {
  const delayed = data.status === 'DELAYED';
  return (
    <div className="ticket">
      <div className="ticket__header">
        <Plane size={16} />
        <span>FLIGHT {data.flightNumber}</span>
        <span className={`badge ${delayed ? 'badge--coral' : 'badge--green'}`}>
          {delayed ? `DELAYED ${data.delayMinutes}m` : 'ON TIME'}
        </span>
      </div>
      <div className="ticket__route">
        <div className="ticket__place">
          <div className="ticket__code">{data.origin.code}</div>
          <div className="ticket__city">{data.origin.city}</div>
        </div>
        <div className="ticket__routeline">
          <Plane size={14} className="ticket__planeicon" />
        </div>
        <div className="ticket__place ticket__place--right">
          <div className="ticket__code">{data.destination.code}</div>
          <div className="ticket__city">{data.destination.city}</div>
        </div>
      </div>
      <div className="ticket__perf" />
      <div className="ticket__meta">
        <div><span className="ticket__label">Date</span>{fmtDate(data.departure)}</div>
        <div><span className="ticket__label">Departs</span>{fmtTime(data.departure)}</div>
        <div><span className="ticket__label">Gate</span>{data.gate}</div>
        <div><span className="ticket__label">Terminal</span>{data.terminal}</div>
      </div>
    </div>
  );
}

export function BoardingPassCard({ data }) {
  return (
    <div className="ticket ticket--boarding">
      <div className="ticket__header">
        <CheckCircle2 size={16} color="var(--green)" />
        <span>BOARDING PASS</span>
      </div>
      <div className="ticket__passname">{data.passengerName}</div>
      <div className="ticket__route">
        <div className="ticket__place">
          <div className="ticket__code">{data.flightNumber}</div>
          <div className="ticket__city">Flight</div>
        </div>
        <div className="ticket__routeline"><Plane size={14} className="ticket__planeicon" /></div>
        <div className="ticket__place ticket__place--right">
          <div className="ticket__code">{data.seat}</div>
          <div className="ticket__city">Seat</div>
        </div>
      </div>
      <div className="ticket__perf" />
      <div className="ticket__meta">
        <div><span className="ticket__label">Gate</span>{data.gate}</div>
        <div><span className="ticket__label">Boarding</span>{fmtTime(data.boardingTime)}</div>
      </div>
      <div className="ticket__barcode">{data.barcode}</div>
    </div>
  );
}

export function CancellationCard({ data }) {
  return (
    <div className="ticket ticket--cancel">
      <div className="ticket__header">
        <XCircle size={16} color="var(--coral)" />
        <span>BOOKING CANCELLED</span>
      </div>
      <div className="ticket__meta ticket__meta--wide">
        <div><span className="ticket__label">PNR</span>{data.pnr}</div>
        <div><span className="ticket__label">Refund</span>₹{data.refund.refundAmount}</div>
        <div><span className="ticket__label">Reference</span>{data.refundReference}</div>
      </div>
    </div>
  );
}

export function SeatMapPreview({ data, onPick }) {
  const rows = [...new Set(data.map((s) => s.row))].slice(0, 6);
  const cols = ['A', 'B', 'C', 'D', 'E', 'F'];
  return (
    <div className="seatmap">
      <div className="seatmap__legend">
        <span><i className="dot dot--free" /> Available</span>
        <span><i className="dot dot--taken" /> Taken</span>
      </div>
      <div className="seatmap__grid">
        {rows.map((r) => (
          <div className="seatmap__row" key={r}>
            <span className="seatmap__rownum">{r}</span>
            {cols.map((c) => {
              const seat = data.find((s) => s.row === r && s.col === c);
              if (!seat) return <span key={c} className="seatmap__gap" />;
              return (
                <button
                  key={c}
                  className={`seatmap__seat ${seat.occupied ? 'is-taken' : ''} ${seat.type === 'extra-legroom' ? 'is-premium' : ''}`}
                  disabled={seat.occupied}
                  onClick={() => onPick && onPick(seat.id)}
                  title={`${seat.id} · ₹${seat.price}`}
                >
                  {c}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export function AgentHandoffBanner() {
  return (
    <div className="handoff-banner">
      <Clock size={16} />
      <span>Connected to a live agent — average wait 3 min</span>
    </div>
  );
}
