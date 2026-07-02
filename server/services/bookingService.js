const { flights, bookings, otpStore } = require('../data/store');

function findBooking(pnr, lastName) {
  const b = bookings[pnr?.toUpperCase()];
  if (!b) return null;
  if (lastName && b.lastName.toLowerCase() !== lastName.toLowerCase()) return null;
  return b;
}

function getBookingSummary(pnr) {
  const b = bookings[pnr];
  if (!b) return null;
  const flight = flights[b.flightNumber];
  return {
    pnr: b.pnr,
    status: b.status,
    fareClass: b.fareClass,
    fareAmount: b.fareAmount,
    currency: b.currency,
    passengers: b.passengers.map((p) => ({
      name: p.name,
      type: p.type,
      seat: p.seat,
      checkedIn: p.checkedIn,
      baggage: p.baggage,
    })),
    flight,
  };
}

function getFlightStatus(flightNumber) {
  return flights[flightNumber?.toUpperCase()] || null;
}

function generateOtp(pnr) {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  otpStore[pnr] = { code, expiresAt: Date.now() + 5 * 60 * 1000 };
  // Simulated delivery — in production this triggers SMS/WhatsApp OTP via CPaaS provider
  return code;
}

function verifyOtp(pnr, code) {
  const rec = otpStore[pnr];
  if (!rec) return false;
  if (Date.now() > rec.expiresAt) return false;
  return rec.code === code;
}

function getAvailableSeats(pnr) {
  const b = bookings[pnr];
  if (!b) return null;
  return Object.values(b.seatMap);
}

function selectSeat(pnr, passengerId, seatId) {
  const b = bookings[pnr];
  if (!b) throw new Error('BOOKING_NOT_FOUND');
  const seat = b.seatMap[seatId];
  if (!seat) throw new Error('SEAT_NOT_FOUND');
  if (seat.occupied) throw new Error('SEAT_OCCUPIED');
  const passenger = b.passengers.find((p) => p.id === passengerId);
  if (!passenger) throw new Error('PASSENGER_NOT_FOUND');

  // free up passenger's previous seat if any
  if (passenger.seat && b.seatMap[passenger.seat]) {
    b.seatMap[passenger.seat].occupied = false;
  }
  seat.occupied = true;
  passenger.seat = seatId;
  return { passenger, seat };
}

function checkIn(pnr, passengerId) {
  const b = bookings[pnr];
  if (!b) throw new Error('BOOKING_NOT_FOUND');
  const passenger = b.passengers.find((p) => p.id === passengerId);
  if (!passenger) throw new Error('PASSENGER_NOT_FOUND');
  if (!passenger.seat) throw new Error('SEAT_REQUIRED');
  passenger.checkedIn = true;
  return {
    passenger,
    boardingPass: {
      pnr: b.pnr,
      passengerName: passenger.name,
      flightNumber: b.flightNumber,
      seat: passenger.seat,
      gate: flights[b.flightNumber].gate,
      boardingTime: flights[b.flightNumber].departure,
      barcode: `${b.pnr}-${passenger.id}-${b.flightNumber}`.toUpperCase(),
    },
  };
}

function calculateCancellationRefund(pnr) {
  const b = bookings[pnr];
  if (!b) return null;
  // simple fare-rule simulation
  const isFlex = b.fareClass.includes('FLEX');
  const cancellationFee = isFlex ? 0 : Math.round(b.fareAmount * 0.3);
  const refundAmount = b.fareAmount - cancellationFee;
  return { fareAmount: b.fareAmount, cancellationFee, refundAmount, currency: b.currency, isFlex };
}

function cancelBooking(pnr) {
  const b = bookings[pnr];
  if (!b) throw new Error('BOOKING_NOT_FOUND');
  if (b.status === 'CANCELLED') throw new Error('ALREADY_CANCELLED');
  const refund = calculateCancellationRefund(pnr);
  b.status = 'CANCELLED';
  // release seats
  b.passengers.forEach((p) => {
    if (p.seat && b.seatMap[p.seat]) b.seatMap[p.seat].occupied = false;
    p.seat = null;
  });
  return { pnr, status: b.status, refund, refundReference: `RF-${pnr}-${Date.now().toString().slice(-6)}` };
}

function addBaggage(pnr, passengerId, extraKg) {
  const b = bookings[pnr];
  if (!b) throw new Error('BOOKING_NOT_FOUND');
  const passenger = b.passengers.find((p) => p.id === passengerId);
  if (!passenger) throw new Error('PASSENGER_NOT_FOUND');
  const pricePerKg = 500;
  const cost = extraKg * pricePerKg;
  passenger.baggage += extraKg;
  return { passenger, extraKg, cost, currency: b.currency };
}

module.exports = {
  findBooking,
  getBookingSummary,
  getFlightStatus,
  generateOtp,
  verifyOtp,
  getAvailableSeats,
  selectSeat,
  checkIn,
  calculateCancellationRefund,
  cancelBooking,
  addBaggage,
};
