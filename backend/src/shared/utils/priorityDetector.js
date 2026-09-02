/*
 * AI priority detection & override (PROMPT 22 / AI priority intelligence).
 *
 * The AI reasons about the correct priority from two signals and can override
 * the tenant's stated priority:
 *
 *   1. Description text  → keyword + severity heuristic
 *   2. Rekognition image → visual emergency / high-severity signals
 *
 * Output: { priority, confidence, reason, overridden } where:
 *   - priority   : AI-decided level (LOW/MEDIUM/HIGH/EMERGENCY)
 *   - overridden : true when the tenant's stated priority was changed
 *
 * DETECTOR_PRIORITY (0 = most severe) is used to compare "real severity" vs the
 * tenant's claim so we can both ESCALATE true emergencies and DOWNGRADE false
 * emergency claims.
 */

export const PRIORITY_ORDER = { EMERGENCY: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

const EMERGENCY_KEYWORDS = [
  'gas leak', 'gas smell', 'carbon monoxide', 'flooding', 'flood', 'burst pipe',
  'fire', 'smoke', 'electrical spark', 'electrical fault', 'live wire',
  'sewage overflow', 'raw sewage', 'structural collapse', 'ceiling collapse',
  'collapse', 'faulty wiring', 'scorched', 'burns', 'burning',
];

const HIGH_KEYWORDS = [
  'broken door', 'security', 'broken lock', 'intruder', 'water damage',
  'major leak', 'pipe burst', 'no water', 'no power', 'power outage', 'no electricity',
  'fridge broken', 'spoilt food', 'broken window', 'severe leak', 'heavy leak',
  'leaking ceiling', 'dangerous', 'unsafe', 'shock', 'electrical shock',
];

const MEDIUM_KEYWORDS = [
  'dripping', 'leak', 'slow drain', 'clogged', 'clog', 'thermostat',
  'not cooling', 'not heating', 'inefficient', 'noisy', 'mold', 'stained',
  'flickering', 'not working', 'broken', 'damaged', 'cracked', 'maintenance',
];

/** Keyword-based severity detection over the description. */
function detectPriorityFromText(description) {
  if (!description) return { priority: 'LOW', confidence: 0, matched: [] };
  const lower = description.toLowerCase();

  const emergencies = EMERGENCY_KEYWORDS.filter((kw) => lower.includes(kw));
  if (emergencies.length > 0) {
    return { priority: 'EMERGENCY', confidence: 0.98, matched: emergencies };
  }

  const highs = HIGH_KEYWORDS.filter((kw) => lower.includes(kw));
  if (highs.length >= 2) {
    return { priority: 'EMERGENCY', confidence: 0.8, matched: highs };
  }
  if (highs.length === 1) {
    return { priority: 'HIGH', confidence: 0.75, matched: highs };
  }

  const mediums = MEDIUM_KEYWORDS.filter((kw) => lower.includes(kw));
  if (mediums.length >= 1) {
    return { priority: 'MEDIUM', confidence: 0.6, matched: mediums };
  }

  return { priority: 'LOW', confidence: 0.4, matched: [] };
}

/** Map a Rekognition visual-emergency signal to a priority bump. */
function detectPriorityFromVisual(visualResult) {
  if (!visualResult) return null;
  if (visualResult.visualEmergency) {
    return { priority: 'EMERGENCY', confidence: 0.95, signal: 'visual-emergency' };
  }
  // High-severity categories without a firm emergency flag still bump to HIGH.
  if (
    visualResult.category === 'Electrical' ||
    visualResult.category === 'Plumbing' ||
    (visualResult.rawLabels && visualResult.rawLabels.length > 0)
  ) {
    return { priority: 'HIGH', confidence: 0.55, signal: 'visual-abnormal' };
  }
  return null;
}

/**
 * Decide the AI priority and whether the tenant's stated priority must be
 * overridden. Returns { priority, confidence, reason, overridden, fromText, fromVisual }.
 *
 * @param {Object} ticket the ticket ({ priority: tenant-stated, description })
 * @param {Object} visualResult optional Rekognition result
 */
function decidePriority(ticket, visualResult = null) {
  const tenantPriority = ticket?.priority || 'MEDIUM';
  const fromText = detectPriorityFromText(ticket?.description);
  const fromVisual = detectPriorityFromVisual(visualResult);

  const candidates = [fromText, fromVisual].filter(Boolean);
  // Most severe candidate wins.
  const decided = candidates.reduce((best, c) => {
    if (!best) return c;
    if (PRIORITY_ORDER[c.priority] < PRIORITY_ORDER[best.priority]) return c;
    return best;
  }, null);

  const decidedPriority = decided?.priority || tenantPriority;
  const overridden = PRIORITY_ORDER[decidedPriority] !== PRIORITY_ORDER[tenantPriority];

  return {
    priority: decidedPriority,
    confidence: decided?.confidence ?? 0,
    reason: decided
      ? decided.signal
        ? `Visual severity (${decided.signal})`
        : `Matched: ${(decided.matched || []).slice(0, 3).join(', ')}`
      : 'No severity indicators detected; kept tenant priority',
    overridden,
    fromText: fromText?.priority || null,
    fromVisual: fromVisual?.priority || null,
  };
}

export default decidePriority;