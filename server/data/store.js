// In-memory mock "Passenger Service System" (PSS) data store.
// In production this file is replaced by real airline API integrations
// (booking/PNR service, DCS for check-in, payment gateway, etc.)

const { v4: uuid } = require('uuid');

const now = new Date();
function daysFromNow(d, h = 8, m = 30) {
  const dt = new Date(now);
  dt.setDate(dt.getDate() + d);
  dt.setHours(h, m, 0, 0);
  return dt.toISOString();
}

// ---- Seat map generator ----
function generateSeatMap(rows = 30, cols = ['A', 'B', 'C', 'D', 'E', 'F']) {
  const seats = {};
  for (let r = 1; r <= rows; r++) {
    cols.forEach((c) => {
      const id = `${r}${c}`;
      const isExit = r === 12 || r === 13;
      const isWindow = c === 'A' || c === 'F';
      const isAisle = c === 'C' || c === 'D';
      let price = 0;
      if (r <= 4) price = 1200; // extra legroom / front
      else if (isExit) price = 900;
      else if (isWindow || isAisle) price = 400;
      else price = 200;
      seats[id] = {
        id,
        row: r,
        col: c,
        type: isExit ? 'exit-row' : r <= 4 ? 'extra-legroom' : 'standard',
        window: isWindow,
        aisle: isAisle,
        price,
        // deterministic pseudo-random occupancy
        occupied: (r * 7 + c.charCodeAt(0)) % 5 === 0,
      };
    });
  }
  return seats;
}

// ---- Flights ----
const flights = {
  BW101: {
    flightNumber: 'BW101',
    origin: { code: 'BOM', city: 'Mumbai' },
    destination: { code: 'DXB', city: 'Dubai' },
    departure: daysFromNow(3, 9, 15),
    arrival: daysFromNow(3, 11, 5),
    aircraft: 'A320neo',
    status: 'ON_TIME',
    gate: 'B12',
    terminal: '2',
  },
  BW202: {
    flightNumber: 'BW202',
    origin: { code: 'DEL', city: 'Delhi' },
    destination: { code: 'LHR', city: 'London' },
    departure: daysFromNow(1, 2, 45),
    arrival: daysFromNow(1, 8, 10),
    aircraft: 'B787-9',
    status: 'DELAYED',
    delayMinutes: 40,
    gate: 'A5',
    terminal: '3',
  },
  BW303: {
    flightNumber: 'BW303',
    origin: { code: 'BLR', city: 'Bengaluru' },
    destination: { code: 'SIN', city: 'Singapore' },
    departure: daysFromNow(7, 23, 0),
    arrival: daysFromNow(8, 6, 30),
    aircraft: 'A321',
    status: 'ON_TIME',
    gate: 'C3',
    terminal: '1',
  },
};

// ---- Bookings (PNRs) ----
// Each booking has its own seat map instance so seat holds don't clash across PNRs.
const bookings = {
  BW7X9K: {
    pnr: 'BW7X9K',
    lastName: 'SHARMA',
    contact: { email: 'r.sharma@example.com', phone: '+91XXXXXXXX01' },
    flightNumber: 'BW101',
    status: 'CONFIRMED',
    passengers: [
      { id: 'p1', name: 'Rohan Sharma', type: 'ADULT', seat: null, checkedIn: false, baggage: 1 },
      { id: 'p2', name: 'Aditi Sharma', type: 'ADULT', seat: null, checkedIn: false, baggage: 1 },
    ],
    fareClass: 'ECONOMY SAVER',
    fareAmount: 24500,
    currency: 'INR',
    seatMap: generateSeatMap(),
    createdAt: daysFromNow(-10),
  },
  BW4M2P: {
    pnr: 'BW4M2P',
    lastName: 'KHAN',
    contact: { email: 'ayesha.khan@example.com', phone: '+91XXXXXXXX02' },
    flightNumber: 'BW202',
    status: 'CONFIRMED',
    passengers: [
      { id: 'p1', name: 'Ayesha Khan', type: 'ADULT', seat: '14C', checkedIn: false, baggage: 2 },
    ],
    fareClass: 'ECONOMY FLEX',
    fareAmount: 58200,
    currency: 'INR',
    seatMap: generateSeatMap(),
    createdAt: daysFromNow(-20),
  },
  BW9Q1Z: {
    pnr: 'BW9Q1Z',
    lastName: 'IYER',
    contact: { email: 'kavya.iyer@example.com', phone: '+91XXXXXXXX03' },
    flightNumber: 'BW303',
    status: 'CONFIRMED',
    passengers: [
      { id: 'p1', name: 'Kavya Iyer', type: 'ADULT', seat: null, checkedIn: false, baggage: 1 },
      { id: 'p2', name: 'Dev Iyer', type: 'CHILD', seat: null, checkedIn: false, baggage: 0 },
    ],
    fareClass: 'ECONOMY SAVER',
    fareAmount: 41300,
    currency: 'INR',
    seatMap: generateSeatMap(),
    createdAt: daysFromNow(-5),
  },
};

// mark the pre-assigned seat as occupied-by-self in BW4M2P's map
bookings.BW4M2P.seatMap['14C'].occupied = false; // reserved for this passenger, shown as "your seat"

// ---- OTP store (simulated) ----
const otpStore = {}; // pnr -> { code, expiresAt }

// ---- Sessions (conversation state) ----
const sessions = {}; // sessionId -> { authenticated, pnr, pendingAction, history, agentHandoff }

function createSession() {
  const id = uuid();
  sessions[id] = {
    id,
    authenticated: false,
    pnr: null,
    context: {},
    failedIntentCount: 0,
    agentHandoff: false,
    createdAt: new Date().toISOString(),
  };
  return sessions[id];
}

module.exports = { flights, bookings, otpStore, sessions, createSession, generateSeatMap };
