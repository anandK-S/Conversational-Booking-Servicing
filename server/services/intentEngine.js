// Lightweight intent classifier for MVP purposes.
// In production this would be replaced by an NLU service (Dialogflow CX, Rasa,
// or an LLM-based intent classifier) but keeping this rule-based keeps the
// MVP deterministic, fast, and dependency-free for demo purposes.

const INTENTS = {
  GREETING: 'GREETING',
  RETRIEVE_BOOKING: 'RETRIEVE_BOOKING',
  FLIGHT_STATUS: 'FLIGHT_STATUS',
  CHECK_IN: 'CHECK_IN',
  SELECT_SEAT: 'SELECT_SEAT',
  CANCEL_BOOKING: 'CANCEL_BOOKING',
  ADD_BAGGAGE: 'ADD_BAGGAGE',
  TALK_TO_AGENT: 'TALK_TO_AGENT',
  CONFIRM: 'CONFIRM',
  DENY: 'DENY',
  MENU: 'MENU',
  HELP: 'HELP',
  UNKNOWN: 'UNKNOWN',
};

const patterns = [
  { intent: INTENTS.GREETING, regex: /\b(hi|hello|hey|good morning|good evening|namaste)\b/i },
  { intent: INTENTS.RETRIEVE_BOOKING, regex: /\b(my booking|find.*booking|pnr|retrieve|my flight details|my trip|my reservation)\b/i },
  { intent: INTENTS.FLIGHT_STATUS, regex: /\b(status|delay|on time|gate|departure time|is my flight)\b/i },
  { intent: INTENTS.CHECK_IN, regex: /\b(check.?in|boarding pass)\b/i },
  { intent: INTENTS.SELECT_SEAT, regex: /\b(seat|window seat|aisle|exit row|change seat)\b/i },
  { intent: INTENTS.CANCEL_BOOKING, regex: /\b(cancel|refund)\b/i },
  { intent: INTENTS.ADD_BAGGAGE, regex: /\b(baggage|luggage|extra bag|excess bag)\b/i },
  { intent: INTENTS.TALK_TO_AGENT, regex: /\b(agent|human|representative|talk to someone|speak to someone|help me now|call me)\b/i },
  { intent: INTENTS.MENU, regex: /\b(menu|start over|main menu|options)\b/i },
  { intent: INTENTS.HELP, regex: /\b(help|what can you do)\b/i },
  { intent: INTENTS.CONFIRM, regex: /^\s*(yes|yep|yeah|confirm|correct|proceed|ok|okay|sure|y)\s*$/i },
  { intent: INTENTS.DENY, regex: /^\s*(no|nope|cancel that|don't|stop|n)\s*$/i },
];

function classify(text) {
  if (!text) return INTENTS.UNKNOWN;
  for (const p of patterns) {
    if (p.regex.test(text)) return p.intent;
  }
  return INTENTS.UNKNOWN;
}

// Extracts a 6-char alphanumeric PNR-like token and a probable last name from free text
function extractPnrAndName(text) {
  const pnrMatch = text.match(/\b([A-Z0-9]{6})\b/i);
  const pnr = pnrMatch ? pnrMatch[1].toUpperCase() : null;
  // crude last-name extraction: look for a capitalised word that isn't the PNR
  const words = text.replace(pnrMatch ? pnrMatch[0] : '', '').split(/\s+/).filter(Boolean);
  const nameWord = words.find((w) => /^[A-Za-z]{2,}$/.test(w));
  return { pnr, lastName: nameWord || null };
}

function extractNumber(text) {
  const m = text.match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

function extractSeatPreference(text) {
  if (/window/i.test(text)) return 'window';
  if (/aisle/i.test(text)) return 'aisle';
  if (/exit/i.test(text)) return 'exit-row';
  if (/legroom|extra.?leg/i.test(text)) return 'extra-legroom';
  const seatIdMatch = text.match(/\b(\d{1,2}[A-F])\b/i);
  if (seatIdMatch) return seatIdMatch[1].toUpperCase();
  return null;
}

module.exports = { INTENTS, classify, extractPnrAndName, extractNumber, extractSeatPreference };
