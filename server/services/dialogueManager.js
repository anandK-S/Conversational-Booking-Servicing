const { sessions } = require('../data/store');
const bookingService = require('./bookingService');
const { INTENTS, classify, extractPnrAndName, extractSeatPreference } = require('./intentEngine');

const MAIN_MENU = [
  { id: 'status', label: '✈️ Flight status' },
  { id: 'checkin', label: '🎫 Check in & seat' },
  { id: 'baggage', label: '🧳 Add baggage' },
  { id: 'cancel', label: '❌ Cancel booking' },
  { id: 'agent', label: '🧑‍💼 Talk to an agent' },
];

function reply(text, opts = {}) {
  return {
    text,
    quickReplies: opts.quickReplies || null,
    widget: opts.widget || null, // structured payload for rich UI rendering (seat map, boarding pass, etc.)
    handoff: opts.handoff || false,
    endSession: opts.endSession || false,
  };
}

function requireAuth(session) {
  return reply(
    "To pull up your booking, I'll need your *PNR* (6-character booking reference) and *last name*.\n\nE.g. \"BW7X9K Sharma\"",
    { quickReplies: [{ id: 'agent', label: 'Talk to an agent instead' }] }
  );
}

function showMenu(session) {
  const b = bookingService.getBookingSummary(session.pnr);
  const name = b?.passengers?.[0]?.name?.split(' ')[0] || 'there';
  return reply(
    `Hi ${name}! Your booking *${session.pnr}* (${b.flight.origin.code} → ${b.flight.destination.code}) is ${b.status}. What would you like to do?`,
    { quickReplies: MAIN_MENU }
  );
}

function handleAuth(session, text) {
  const { pnr, lastName } = extractPnrAndName(text.toUpperCase());
  if (!pnr || !lastName) {
    session.failedIntentCount++;
    return maybeEscalate(session, reply(
      "I couldn't quite catch that. Please send your PNR and last name together, e.g. *BW7X9K Sharma*.",
      { quickReplies: [{ id: 'agent', label: 'Talk to an agent instead' }] }
    ));
  }
  const booking = bookingService.findBooking(pnr, lastName);
  if (!booking) {
    session.failedIntentCount++;
    return maybeEscalate(session, reply(
      `I couldn't find a booking matching *${pnr}* / *${lastName}*. Please double-check and try again, or try one of our demo PNRs: BW7X9K (Sharma), BW4M2P (Khan), BW9Q1Z (Iyer).`,
      { quickReplies: [{ id: 'agent', label: 'Talk to an agent instead' }] }
    ));
  }
  session.authenticated = true;
  session.pnr = booking.pnr;
  session.failedIntentCount = 0;
  return showMenu(session);
}

function maybeEscalate(session, fallbackReply) {
  if (session.failedIntentCount >= 2) {
    session.agentHandoff = true;
    return reply(
      "I'm having trouble helping with that through chat. Let me connect you with a support agent who can take it from here — they'll have your conversation history so you won't need to repeat yourself.",
      { handoff: true }
    );
  }
  return fallbackReply;
}

function handleFlightStatus(session) {
  const b = bookingService.getBookingSummary(session.pnr);
  const f = b.flight;
  const statusLine =
    f.status === 'DELAYED'
      ? `⚠️ *Delayed by ${f.delayMinutes} minutes*`
      : `✅ *On time*`;
  const dep = new Date(f.departure);
  return reply(
    `Flight *${f.flightNumber}* — ${f.origin.city} (${f.origin.code}) → ${f.destination.city} (${f.destination.code})\n\n${statusLine}\nDeparture: ${dep.toDateString()}, ${dep.toTimeString().slice(0, 5)}\nTerminal ${f.terminal}, Gate ${f.gate}\nAircraft: ${f.aircraft}`,
    { quickReplies: MAIN_MENU, widget: { type: 'flight_status', data: f } }
  );
}

function handleCheckInStart(session) {
  const b = bookingService.getBookingSummary(session.pnr);
  const pending = b.passengers.filter((p) => !p.checkedIn);
  if (pending.length === 0) {
    return reply('All passengers on this booking are already checked in! ✅', { quickReplies: MAIN_MENU });
  }
  session.context.flow = 'CHECKIN_SELECT_PASSENGER';
  session.context.pendingPassengers = pending.map((p) => p.name);
  const options = pending.map((p, i) => ({ id: `pax_${i}`, label: p.name }));
  return reply('Who would you like to check in?', { quickReplies: options });
}

function handleSeatSelectionStart(session, passengerName) {
  const seats = bookingService.getAvailableSeats(session.pnr);
  session.context.flow = 'SEAT_SELECT';
  session.context.checkInPassengerName = passengerName;
  const available = seats.filter((s) => !s.occupied);
  const sample = {
    window: available.filter((s) => s.window).slice(0, 3).map((s) => s.id),
    aisle: available.filter((s) => s.aisle).slice(0, 3).map((s) => s.id),
    extraLegroom: available.filter((s) => s.type === 'extra-legroom').slice(0, 3).map((s) => s.id),
  };
  return reply(
    `Great — checking in *${passengerName}*. Pick a seat, or tell me a preference (window / aisle / extra legroom).\n\nSuggestions:\n🪟 Window: ${sample.window.join(', ')}\n🚶 Aisle: ${sample.aisle.join(', ')}\n🦵 Extra legroom: ${sample.extraLegroom.join(', ')} (+₹1200)`,
    { widget: { type: 'seat_map', data: available }, quickReplies: sample.window.slice(0, 1).map(s => ({id: `seat_${s}`, label: s})) }
  );
}

function findSeatFromPreference(session, pref) {
  const seats = bookingService.getAvailableSeats(session.pnr);
  if (/^\d{1,2}[A-F]$/.test(pref)) {
    const exact = seats.find((s) => s.id === pref && !s.occupied);
    return exact || null;
  }
  const byType = {
    window: (s) => s.window,
    aisle: (s) => s.aisle,
    'exit-row': (s) => s.type === 'exit-row',
    'extra-legroom': (s) => s.type === 'extra-legroom',
  };
  const filterFn = byType[pref];
  if (!filterFn) return null;
  return seats.find((s) => !s.occupied && filterFn(s)) || null;
}

function completeSeatAndCheckIn(session, seat) {
  const b = bookingService.getBookingSummary(session.pnr);
  const passengerName = session.context.checkInPassengerName;
  const fullBooking = require('../data/store').bookings[session.pnr];
  const passenger = fullBooking.passengers.find((p) => p.name === passengerName);
  bookingService.selectSeat(session.pnr, passenger.id, seat.id);
  const { boardingPass } = bookingService.checkIn(session.pnr, passenger.id);
  session.context.flow = null;
  return reply(
    `You're checked in! 🎉\n\n*Boarding Pass*\n${passenger.name}\nFlight ${boardingPass.flightNumber} · Seat ${boardingPass.seat}\nGate ${boardingPass.gate}\nRef: ${boardingPass.barcode}`,
    { widget: { type: 'boarding_pass', data: boardingPass }, quickReplies: MAIN_MENU }
  );
}

function handleCancelStart(session) {
  const refund = bookingService.calculateCancellationRefund(session.pnr);
  session.context.flow = 'CANCEL_CONFIRM';
  const otp = bookingService.generateOtp(session.pnr); // simulate sending OTP
  session.context.otpForDemo = otp; // exposed in response for demo purposes only
  return reply(
    `Cancelling *${session.pnr}* — here's the breakdown:\n\nFare paid: ₹${refund.fareAmount}\nCancellation fee: ₹${refund.cancellationFee}\n*Refund amount: ₹${refund.refundAmount}*\n\nFor security, I've sent a 6-digit OTP to your registered mobile number. Please enter it to confirm cancellation.\n\n_(Demo OTP: ${otp})_`,
    { quickReplies: [{ id: 'deny', label: 'Don\'t cancel' }] }
  );
}

function handleCancelOtp(session, text) {
  const code = text.replace(/\D/g, '');
  if (!bookingService.verifyOtp(session.pnr, code)) {
    session.failedIntentCount++;
    return maybeEscalate(session, reply('That OTP doesn\'t match. Please re-enter the 6-digit code, or say "agent" for help.'));
  }
  const result = bookingService.cancelBooking(session.pnr);
  session.context.flow = null;
  return reply(
    `Your booking *${session.pnr}* has been cancelled.\n\nRefund of ₹${result.refund.refundAmount} will be processed to your original payment method within 5-7 business days.\nRefund reference: ${result.refundReference}`,
    { widget: { type: 'cancellation', data: result }, quickReplies: [{ id: 'menu', label: 'Back to menu' }] }
  );
}

function handleBaggageStart(session) {
  session.context.flow = 'BAGGAGE_SELECT';
  return reply('How many extra kilograms of baggage would you like to add? (₹500/kg)', {
    quickReplies: [
      { id: 'bag_5', label: '+5 kg' },
      { id: 'bag_10', label: '+10 kg' },
      { id: 'bag_15', label: '+15 kg' },
    ],
  });
}

function handleBaggageComplete(session, kg) {
  const fullBooking = require('../data/store').bookings[session.pnr];
  const passenger = fullBooking.passengers[0];
  const result = bookingService.addBaggage(session.pnr, passenger.id, kg);
  session.context.flow = null;
  return reply(
    `Added ${kg}kg extra baggage for ${passenger.name}. Cost: ₹${result.cost} (simulated payment successful ✅)\n\nTotal baggage allowance now: ${passenger.baggage}kg extra.`,
    { quickReplies: MAIN_MENU }
  );
}

function handleAgentHandoff(session) {
  session.agentHandoff = true;
  return reply(
    "Connecting you to a support agent now. Your booking details and this conversation will be shared with them so you don't have to repeat anything. Average wait time: 3 minutes. 🧑‍💼",
    { handoff: true }
  );
}

// Main entry point
function handleMessage(sessionId, rawText) {
  const session = sessions[sessionId];
  if (!session) throw new Error('SESSION_NOT_FOUND');
  const text = (rawText || '').trim();

  if (session.agentHandoff) {
    return reply("You're currently connected with a support agent. They'll respond here shortly.", { handoff: true });
  }

  // In-flow handling takes priority over generic intent classification
  if (session.context.flow === 'CHECKIN_SELECT_PASSENGER') {
    const idx = text.match(/pax_(\d+)/)?.[1];
    const name = idx != null ? session.context.pendingPassengers[idx] : session.context.pendingPassengers.find((n) => text.toLowerCase().includes(n.toLowerCase().split(' ')[0]));
    if (!name) return maybeEscalate(session, reply('Please pick a passenger from the list.', { quickReplies: session.context.pendingPassengers.map((n, i) => ({ id: `pax_${i}`, label: n })) }));
    return handleSeatSelectionStart(session, name);
  }

  if (session.context.flow === 'SEAT_SELECT') {
    const seatIdMatch = text.match(/seat_(\d{1,2}[A-F])/i);
    const pref = seatIdMatch ? seatIdMatch[1].toUpperCase() : extractSeatPreference(text);
    if (!pref) return maybeEscalate(session, reply('Sorry, I didn\'t catch a seat preference — try "window", "aisle", or a seat number like 14C.'));
    const seat = findSeatFromPreference(session, pref);
    if (!seat) return reply(`That seat isn't available. Try another preference, e.g. "aisle" or "12A".`);
    return completeSeatAndCheckIn(session, seat);
  }

  if (session.context.flow === 'CANCEL_CONFIRM') {
    if (/^\d{4,6}$/.test(text.replace(/\s/g, ''))) return handleCancelOtp(session, text);
    if (classify(text) === INTENTS.DENY || text === 'deny') {
      session.context.flow = null;
      return reply('No problem, your booking remains active.', { quickReplies: MAIN_MENU });
    }
    return reply('Please enter the 6-digit OTP to confirm cancellation, or say "no" to keep your booking.');
  }

  if (session.context.flow === 'BAGGAGE_SELECT') {
    const m = text.match(/(\d+)/);
    if (!m) return reply('Please choose an amount, e.g. "5kg".', { quickReplies: [{ id: 'bag_5', label: '+5 kg' }, { id: 'bag_10', label: '+10 kg' }] });
    return handleBaggageComplete(session, parseInt(m[1], 10));
  }

  // Not authenticated yet -> try to auth on every message
  if (!session.authenticated) {
    if (classify(text) === INTENTS.TALK_TO_AGENT) return handleAgentHandoff(session);
    if (classify(text) === INTENTS.GREETING && !/[A-Z0-9]{6}/i.test(text)) {
      return reply(
        "👋 Welcome to BlueWings! I'm your virtual assistant — I can help with check-in, seat selection, flight status, baggage, and cancellations.\n\nTo get started, please share your *PNR* and *last name*.",
      );
    }
    return handleAuth(session, text);
  }

  // Authenticated — classify general intent
  const intent = classify(text);
  switch (intent) {
    case INTENTS.MENU:
      session.failedIntentCount = 0;
      return showMenu(session);
    case INTENTS.FLIGHT_STATUS:
      session.failedIntentCount = 0;
      return handleFlightStatus(session);
    case INTENTS.CHECK_IN:
    case INTENTS.SELECT_SEAT:
      session.failedIntentCount = 0;
      return handleCheckInStart(session);
    case INTENTS.CANCEL_BOOKING:
      session.failedIntentCount = 0;
      return handleCancelStart(session);
    case INTENTS.ADD_BAGGAGE:
      session.failedIntentCount = 0;
      return handleBaggageStart(session);
    case INTENTS.TALK_TO_AGENT:
      return handleAgentHandoff(session);
    case INTENTS.HELP:
      session.failedIntentCount = 0;
      return reply('I can help you check flight status, check in & pick a seat, add baggage, or cancel a booking. What would you like to do?', { quickReplies: MAIN_MENU });
    default: {
      // handle quick-reply button ids directly
      if (text === 'status') return handleFlightStatus(session);
      if (text === 'checkin') return handleCheckInStart(session);
      if (text === 'baggage') return handleBaggageStart(session);
      if (text === 'cancel') return handleCancelStart(session);
      if (text === 'agent') return handleAgentHandoff(session);
      if (text === 'menu') return showMenu(session);
      session.failedIntentCount++;
      return maybeEscalate(session, reply(
        "Sorry, I didn't quite get that. Here's what I can help with:",
        { quickReplies: MAIN_MENU }
      ));
    }
  }
}

module.exports = { handleMessage, MAIN_MENU };
