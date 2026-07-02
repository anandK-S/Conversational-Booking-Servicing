const express = require('express');
const cors = require('cors');
const path = require('path');
const { sessions, createSession } = require('./data/store');
const dialogueManager = require('./services/dialogueManager');
const bookingService = require('./services/bookingService');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;

// ---------- Conversational API (used by chat widget) ----------

app.post('/api/session', (req, res) => {
  const session = createSession();
  res.json({ sessionId: session.id });
});

app.post('/api/chat', (req, res) => {
  const { sessionId, message } = req.body;
  if (!sessionId || !sessions[sessionId]) {
    return res.status(400).json({ error: 'INVALID_SESSION' });
  }
  try {
    const result = dialogueManager.handleMessage(sessionId, message);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

app.get('/api/session/:id', (req, res) => {
  const session = sessions[req.params.id];
  if (!session) return res.status(404).json({ error: 'NOT_FOUND' });
  res.json(session);
});

// ---------- REST Booking API ----------
// These mirror what a real airline PSS/DCS integration would expose.
// Documented separately in docs/api-design.md

app.get('/api/v1/bookings/:pnr', (req, res) => {
  const { lastName } = req.query;
  const booking = bookingService.findBooking(req.params.pnr, lastName);
  if (!booking) return res.status(404).json({ error: 'BOOKING_NOT_FOUND' });
  res.json(bookingService.getBookingSummary(booking.pnr));
});

app.get('/api/v1/flights/:flightNumber/status', (req, res) => {
  const status = bookingService.getFlightStatus(req.params.flightNumber);
  if (!status) return res.status(404).json({ error: 'FLIGHT_NOT_FOUND' });
  res.json(status);
});

app.get('/api/v1/bookings/:pnr/seatmap', (req, res) => {
  const seats = bookingService.getAvailableSeats(req.params.pnr);
  if (!seats) return res.status(404).json({ error: 'BOOKING_NOT_FOUND' });
  res.json({ seats });
});

app.post('/api/v1/bookings/:pnr/passengers/:passengerId/seat', (req, res) => {
  const { seatId } = req.body;
  try {
    const result = bookingService.selectSeat(req.params.pnr, req.params.passengerId, seatId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/v1/bookings/:pnr/passengers/:passengerId/checkin', (req, res) => {
  try {
    const result = bookingService.checkIn(req.params.pnr, req.params.passengerId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/v1/bookings/:pnr/cancel', (req, res) => {
  const { otp } = req.body;
  if (!bookingService.verifyOtp(req.params.pnr, otp)) {
    return res.status(401).json({ error: 'INVALID_OTP' });
  }
  try {
    const result = bookingService.cancelBooking(req.params.pnr);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/v1/bookings/:pnr/otp', (req, res) => {
  const code = bookingService.generateOtp(req.params.pnr);
  // simulated — in production this returns 202 Accepted with no code in body
  res.json({ sent: true, demoCode: code });
});

app.post('/api/v1/bookings/:pnr/passengers/:passengerId/baggage', (req, res) => {
  const { extraKg } = req.body;
  try {
    const result = bookingService.addBaggage(req.params.pnr, req.params.passengerId, extraKg);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// ---------- Serve built client (PWA) ----------
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get(/(.*)/, (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(clientDist, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`BlueWings server running on http://localhost:${PORT}`);
});
