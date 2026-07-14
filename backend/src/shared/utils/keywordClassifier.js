const CATEGORY_KEYWORDS = [
  { category: 'Plumbing', keywords: ['leak', 'pipe', 'drain', 'toilet', 'sink', 'faucet', 'water', 'plumbing', 'sewer', 'tap', 'shower', 'bathtub', 'overflow', 'clog', 'drip'] },
  { category: 'Electrical', keywords: ['electrical', 'wiring', 'outlet', 'switch', 'light', 'power', 'breaker', 'fuse', 'socket', 'shock', 'spark', 'flicker', 'circuit', 'short'] },
  { category: 'HVAC', keywords: ['hvac', 'heating', 'cooling', 'ac', 'air condition', 'furnace', 'thermostat', 'vent', 'fan', 'heat', 'aircon', 'no heat', 'no cold'] },
  { category: 'Appliances', keywords: ['appliance', 'fridge', 'refrigerator', 'dishwasher', 'washer', 'dryer', 'stove', 'oven', 'microwave', 'freezer', 'washing machine'] },
  { category: 'Structural', keywords: ['structural', 'wall', 'ceiling', 'floor', 'roof', 'foundation', 'crack', 'door', 'window', 'frame', 'hole', 'damage', 'mold', 'rot', 'water stain'] },
  { category: 'Security', keywords: ['security', 'lock', 'alarm', 'camera', 'doorbell', 'key', 'intrusion', 'broken lock', 'keypad', 'intercom'] },
  { category: 'Landscaping', keywords: ['landscaping', 'garden', 'lawn', 'fence', 'tree', 'grass', 'outdoor', 'yard', 'sprinkler', 'irrigation', 'gate', 'patio', 'weed'] },
  { category: 'Pest Control', keywords: ['pest', 'bug', 'insect', 'rodent', 'rat', 'mouse', 'cockroach', 'termite', 'ant', 'infestation', 'roach', 'spider', 'bee', 'wasp'] },
  { category: 'Emergency', keywords: ['emergency', 'urgent', 'fire', 'smoke', 'flood', 'gas leak', 'no power', 'no water', 'break in', 'immediate'] },
];

export default function keywordClassify(text) {
  if (!text || text.trim().length < 5) {
    return { category: 'Other', confidence: 0.1, service: 'KEYWORD' };
  }

  const lower = text.toLowerCase();
  const scores = CATEGORY_KEYWORDS.map(({ category, keywords }) => {
    const matchCount = keywords.filter(kw => lower.includes(kw)).length;
    const score = Math.min(matchCount / Math.max(Math.ceil(keywords.length * 0.3), 1), 1);
    return { category, score };
  });

  scores.sort((a, b) => b.score - a.score);
  const top = scores[0];

  if (top.score <= 0) {
    return { category: 'Other', confidence: 0.15, service: 'KEYWORD' };
  }

  return {
    category: top.category,
    confidence: Math.round(Math.max(top.score, 0.15) * 100) / 100,
    service: 'KEYWORD',
  };
}

export { CATEGORY_KEYWORDS };
