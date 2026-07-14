/*
 * Entity extraction — identifies location, item, and issue from ticket text.
 * Uses keyword matching + AWS Comprehend (if available) for entity detection.
 */

const LOCATIONS = [
  'kitchen', 'bathroom', 'bedroom', 'living room', 'dining room', 'hallway',
  'garage', 'basement', 'attic', 'laundry', 'balcony', 'patio', 'roof',
  'garden', 'driveway', 'entrance', 'lobby', 'staircase', 'corridor',
  'master bedroom', 'guest room', 'study', 'office', 'pantry', 'utility room',
];

const ITEMS = [
  'sink', 'toilet', 'bathtub', 'shower', 'faucet', 'pipe', 'drain', 'water heater',
  'door', 'window', 'wall', 'ceiling', 'floor', 'roof', 'fence', 'gate',
  'light', 'outlet', 'switch', 'breaker', 'wiring', 'thermostat',
  'fridge', 'refrigerator', 'dishwasher', 'washer', 'dryer', 'stove', 'oven', 'microwave',
  'ac unit', 'furnace', 'heater', 'vent', 'duct', 'fan',
  'lock', 'alarm', 'camera', 'doorbell',
  'cabinet', 'countertop', 'tile', 'carpet', 'shelf', 'drawer',
  'toilet paper holder', 'towel rack', 'mirror', 'shower head',
  'radiator', 'boiler', 'garbage disposal', 'smoke detector',
];

const ISSUES = [
  'leak', 'crack', 'broken', 'noise', 'clog', 'stuck', 'loose',
  'damage', 'dripping', 'overflow', 'flood', 'mold', 'rust', 'corrosion',
  'overheating', 'short circuit', 'power outage', 'flickering', 'not working',
  'stained', 'stained water', 'rotten', 'worn', 'sagging', 'bubbling',
  'blocked', 'disconnected', 'frozen', 'shattered', 'hole', 'dent',
  'misaligned', 'rattling', 'grinding', 'squeaking', 'banging',
];

const ENTITY_TYPES = { location: LOCATIONS, item: ITEMS, issue: ISSUES };

function extractEntities(text) {
  if (!text) return [];

  const lower = text.toLowerCase();
  const found = [];

  for (const [type, keywords] of Object.entries(ENTITY_TYPES)) {
    for (const kw of keywords) {
      const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'i');
      const match = lower.match(regex);
      if (match) {
        found.push({
          entityType: type,
          value: kw,
          confidence: 1.0,
          source: 'keyword',
        });
      }
    }
  }

  return found;
}

function deduplicateEntities(entities) {
  const seen = new Set();
  return entities.filter(e => {
    const key = `${e.entityType}:${e.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export { extractEntities, deduplicateEntities, LOCATIONS, ITEMS, ISSUES };
