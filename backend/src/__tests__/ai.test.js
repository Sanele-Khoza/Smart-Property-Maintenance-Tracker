import { jest } from '@jest/globals';
import { classify, CONFIDENCE_THRESHOLD, VISUAL_EMERGENCY_THRESHOLD } from '../shared/utils/aiClassifier.js';
import { classifyText } from '../modules/ai/comprehend.service.js';
import { analyzeImage, mapLabelsToCategory, isVisualEmergency } from '../modules/ai/rekognition.service.js';
import { extractEntities, deduplicateEntities } from '../modules/ai/entityExtractor.js';
import { cosineSimilarity, tokenize } from '../modules/ai/duplicateDetector.js';

describe('aiClassifier — 5-step conflict resolution', () => {
  const textResult = { category: 'Plumbing', confidence: 0.85, service: 'comprehend' };
  const visualResult = { category: 'Plumbing', confidence: 0.75, service: 'rekognition' };

  it('Step 1: returns EMERGENCY when visual emergency >= 0.70', () => {
    const result = classify(textResult, visualResult, { imageIsEmergency: true });
    expect(result.outcome).toBe('EMERGENCY');
    expect(result.visualEmergency).toBe(true);
  });

  it('Step 2: returns AGREE when categories match and combined >= 0.60', () => {
    const result = classify(textResult, visualResult);
    expect(result.outcome).toBe('AGREE');
    expect(result.primaryCategory).toBe('Plumbing');
    expect(result.combinedConfidence).toBeCloseTo(0.79, 2);
  });

  it('Step 2: returns MANUAL_REVIEW when categories match but combined < 0.60', () => {
    const result = classify(
      { category: 'Electrical', confidence: 0.3 },
      { category: 'Electrical', confidence: 0.3 }
    );
    expect(result.outcome).toBe('MANUAL_REVIEW');
    expect(result.requiresManualReview).toBe(true);
  });

  it('Step 3: returns MANUAL_REVIEW when categories differ and either < 0.60', () => {
    const result = classify(
      { category: 'Plumbing', confidence: 0.8 },
      { category: 'Electrical', confidence: 0.4 }
    );
    expect(result.outcome).toBe('MANUAL_REVIEW');
    expect(result.requiresManualReview).toBe(true);
  });

  it('Step 4: returns CONFLICT when categories differ and both >= 0.60 (image category primary)', () => {
    const result = classify(
      { category: 'Plumbing', confidence: 0.8 },
      { category: 'Electrical', confidence: 0.8 }
    );
    expect(result.outcome).toBe('CONFLICT');
    expect(result.conflictDetected).toBe(true);
    expect(result.primaryCategory).toBe('Electrical');
  });

  it('Step 5: returns MANUAL_REVIEW when both AWS unavailable', () => {
    const result = classify(
      { category: 'Plumbing', confidence: 0, service: 'none' },
      { category: null, confidence: 0, service: 'none' },
      { awsTextAvailable: false, awsVisualAvailable: false }
    );
    expect(result.outcome).toBe('MANUAL_REVIEW');
    expect(result.awsUnavailable).toBe(true);
  });

  it('returns correct combined confidence calculation', () => {
    const result = classify(
      { category: 'Plumbing', confidence: 0.5 },
      { category: 'Plumbing', confidence: 0.9 }
    );
    expect(result.combinedConfidence).toBeCloseTo(0.74, 2);
    expect(result.outcome).toBe('AGREE');
  });
});

describe('comprehend.service — keyword fallback classification', () => {
  it('classifies plumbing text', async () => {
    const result = await classifyText('The kitchen sink is leaking water everywhere');
    expect(result.category).toBe('Plumbing');
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.service).toBeDefined();
  });

  it('classifies electrical text', async () => {
    const result = await classifyText('The power outlet in the bedroom is not working');
    expect(result.category).toBe('Electrical');
  });

  it('classifies HVAC text', async () => {
    const result = await classifyText('The air conditioning unit is blowing hot air');
    expect(result.category).toBe('HVAC');
  });

  it('classifies structural text', async () => {
    const result = await classifyText('There is a crack in the living room wall');
    expect(result.category).toBe('Structural');
  });

  it('falls back to Other for unrecognized text', async () => {
    const result = await classifyText('xyzzy something random noise');
    expect(result.category).toBe('Other');
  });

  it('handles very short text gracefully', async () => {
    const result = await classifyText('hi');
    expect(result.category).toBe('Other');
    expect(result.confidence).toBeGreaterThanOrEqual(0.1);
  });
});

describe('rekognition.service — label mapping', () => {
  it('maps plumbing labels correctly', () => {
    const result = mapLabelsToCategory(['Faucet', 'Sink', 'Water']);
    expect(result.category).toBe('Plumbing');
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('maps electrical labels correctly', () => {
    const result = mapLabelsToCategory(['Outlet', 'Wire', 'Switch']);
    expect(result.category).toBe('Electrical');
  });

  it('detects abnormal condition from water + damage labels', () => {
    const labels = ['Sink', 'Water Damage', 'Mold'];
    const result = mapLabelsToCategory(labels);
    expect(result.category).toBe('Plumbing');
    expect(result.abnormalDetected).toBe(true);
  });

  it('isVisualEmergency triggers for plumbing + water/leak', () => {
    const labels = [{ name: 'Water', confidence: 0.9 }, { name: 'Leak', confidence: 0.8 }];
    expect(isVisualEmergency('Plumbing', labels)).toBe(true);
  });

  it('isVisualEmergency triggers for electrical + fire/smoke', () => {
    const labels = [{ name: 'Smoke', confidence: 0.9 }, { name: 'Fire Damage', confidence: 0.8 }];
    expect(isVisualEmergency('Electrical', labels)).toBe(true);
  });

  it('isVisualEmergency returns false for normal conditions', () => {
    const labels = [{ name: 'Sink', confidence: 0.9 }];
    expect(isVisualEmergency('Plumbing', labels)).toBe(false);
  });
});

describe('entityExtractor', () => {
  it('extracts location entities', () => {
    const entities = extractEntities('The kitchen sink is leaking');
    const locations = entities.filter(e => e.entityType === 'location');
    expect(locations.length).toBeGreaterThan(0);
    expect(locations[0].value).toBe('kitchen');
  });

  it('extracts item entities', () => {
    const entities = extractEntities('The toilet in the bathroom is broken');
    const items = entities.filter(e => e.entityType === 'item');
    expect(items.some(e => e.value === 'toilet')).toBe(true);
  });

  it('extracts issue entities', () => {
    const entities = extractEntities('There is a crack in the wall');
    const issues = entities.filter(e => e.entityType === 'issue');
    expect(issues.some(e => e.value === 'crack')).toBe(true);
  });

  it('deduplicates entities', () => {
    const entities = [
      { entityType: 'location', value: 'kitchen' },
      { entityType: 'location', value: 'kitchen' },
      { entityType: 'item', value: 'sink' },
    ];
    const deduped = deduplicateEntities(entities);
    expect(deduped).toHaveLength(2);
  });

  it('returns empty array for empty text', () => {
    expect(extractEntities('')).toEqual([]);
  });
});

describe('duplicateDetector — text similarity', () => {
  it('tokenize splits text correctly', () => {
    const tokens = tokenize('The kitchen sink is leaking!');
    expect(tokens).toContain('kitchen');
    expect(tokens).toContain('sink');
    expect(tokens).toContain('leaking');
  });

  it('tokenize removes short words (length <= 2)', () => {
    const tokens = tokenize('a is the and on in at');
    expect(tokens).toEqual(['the', 'and']);
  });

  it('cosineSimilarity returns 1 for identical texts', () => {
    const a = { word: 2, test: 1 };
    const b = { word: 2, test: 1 };
    expect(cosineSimilarity(a, b)).toBeCloseTo(1, 5);
  });

  it('cosineSimilarity returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity({ foo: 1 }, { bar: 1 })).toBe(0);
  });

  it('cosineSimilarity returns value between 0 and 1 for partial overlap', () => {
    const sim = cosineSimilarity({ water: 2, leak: 1 }, { water: 1, pipe: 1 });
    expect(sim).toBeGreaterThan(0);
    expect(sim).toBeLessThan(1);
  });
});
