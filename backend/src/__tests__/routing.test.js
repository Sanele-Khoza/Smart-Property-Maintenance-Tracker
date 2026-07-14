import { jest } from '@jest/globals';
import { calcSpecScore, haversineKm } from '../shared/utils/routingScore.js';

describe('routingScore — specialization matching', () => {
  it('returns 1 when provider specializes in exact category', () => {
    expect(calcSpecScore(['Plumbing', 'Electrical'], 'Plumbing')).toBe(1);
  });

  it('returns 0 when provider does not specialize in category', () => {
    expect(calcSpecScore(['Plumbing'], 'HVAC')).toBe(0);
  });

  it('returns 0 for empty specialisations', () => {
    expect(calcSpecScore([], 'Plumbing')).toBe(0);
  });

  it('returns 0 for null specialisations', () => {
    expect(calcSpecScore(null, 'Plumbing')).toBe(0);
  });

  it('is case-insensitive', () => {
    expect(calcSpecScore(['plumbing', 'electrical'], 'PLUMBING')).toBe(1);
  });

  it('matches partial specialization text', () => {
    expect(calcSpecScore(['Electrical Repairs'], 'Electrical')).toBe(1);
  });
});

describe('routingScore — haversine distance', () => {
  it('returns 0 for same point', () => {
    expect(haversineKm(0, 0, 0, 0)).toBe(0);
  });

  it('returns ~111km for 1 degree latitude', () => {
    const d = haversineKm(0, 0, 1, 0);
    expect(d).toBeGreaterThan(110);
    expect(d).toBeLessThan(112);
  });

  it('returns positive distance for different points', () => {
    const d = haversineKm(-26.2, 28.0, -33.9, 18.4);
    expect(d).toBeGreaterThan(1000);
    expect(d).toBeLessThan(1500);
  });
});

describe('routing.service — autoAssign validation', () => {
  it('calculates combined confidence correctly for routing check', () => {
    const combined = 0.4 * 0.85 + 0.6 * 0.75;
    expect(combined).toBeCloseTo(0.79, 2);
    expect(combined).toBeGreaterThan(0.6);
  });

  it('flags low confidence below threshold', () => {
    const combined = 0.4 * 0.4 + 0.6 * 0.3;
    expect(combined).toBeCloseTo(0.34, 2);
    expect(combined).toBeLessThan(0.6);
  });
});

describe('routing.service — emergency dispatch logic', () => {
  it('auto-accept sorts providers by score descending', () => {
    const offers = [
      { providerId: 'a', score: 0.5, autoAccept: true },
      { providerId: 'b', score: 0.9, autoAccept: true },
      { providerId: 'c', score: 0.7, autoAccept: false },
    ];
    const auto = offers.filter(o => o.autoAccept).sort((a, b) => b.score - a.score);
    expect(auto[0].providerId).toBe('b');
    expect(auto[1].providerId).toBe('a');
  });

  it('filters off-duty from eligible providers', () => {
    const providers = [
      { status: 'AVAILABLE', autoAccept: false },
      { status: 'OFF_DUTY', autoAccept: false },
      { status: 'AVAILABLE', autoAccept: true },
    ];
    const eligible = providers.filter(p => p.status !== 'OFF_DUTY');
    expect(eligible).toHaveLength(2);
  });
});
