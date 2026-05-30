import { jest } from '@jest/globals';
import { providerMatchesCategory } from '../shared/utils/routingScore.js';
import {
  AUTO_ASSIGNED_STATUSES,
  getAutoAssignCutoff,
  isEligibleForAutoAssign,
} from '../shared/utils/autoAssignGate.js';

const baseTicket = {
  id: 'T1',
  status: 'New',
  priority: 'HIGH',
  ai_confidence: 0.82,
  ai_text_confidence: 0.8,
  ai_visual_confidence: 0.85,
  assigned_to: null,
  deleted_at: null,
  no_provider_flagged_at: null,
  auto_assigned_at: null,
  auto_assigned: false,
  created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
};

describe('S3 — specialisation is a HARD filter (providerMatchesCategory)', () => {
  it('accepts a provider specialized in the exact category', () => {
    expect(providerMatchesCategory(['Plumbing', 'Electrical'], 'Plumbing')).toBe(true);
  });

  it('rejects a provider without the category', () => {
    expect(providerMatchesCategory(['Roofing'], 'Plumbing')).toBe(false);
  });

  it('rejects when provider has no specialisations', () => {
    expect(providerMatchesCategory([], 'Plumbing')).toBe(false);
    expect(providerMatchesCategory(null, 'Plumbing')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(providerMatchesCategory(['plumbing'], 'PLUMBING')).toBe(true);
  });

  it('matches partial specialisation text both ways', () => {
    expect(providerMatchesCategory(['Electrical Repairs'], 'Electrical')).toBe(true);
    expect(providerMatchesCategory(['General'], 'General Maintenance')).toBe(true);
  });

  it('treats missing ticket category as "any specialisation ok"', () => {
    expect(providerMatchesCategory(['Plumbing'], '')).toBe(true);
  });
});

describe('S4 — auto-assign delay cutoff (getAutoAssignCutoff)', () => {
  it('is exactly the delay minutes before base time', () => {
    const base = new Date('2026-08-31T12:00:00Z');
    const cutoff = getAutoAssignCutoff(base, 30);
    expect(cutoff.toISOString()).toBe('2026-08-31T11:30:00.000Z');
  });

  it('scales linearly with the per-priority minutes', () => {
    const base = new Date('2026-08-31T12:00:00Z');
    expect(getAutoAssignCutoff(base, 480).toISOString())
      .toBe('2026-08-31T04:00:00.000Z');
  });
});

describe('S4 — ticket eligibility gate (isEligibleForAutoAssign)', () => {
  const cutoff = getAutoAssignCutoff(Date.now(), 30);

  it('accepts an unassigned, cleanly-classified, expired-delay ticket', () => {
    expect(isEligibleForAutoAssign(baseTicket, cutoff)).toBe(true);
  });

  it('rejects a ticket already assigned (the race-guard outcome)', () => {
    expect(isEligibleForAutoAssign({ ...baseTicket, assigned_to: 'P1' }, cutoff)).toBe(false);
  });

  it('rejects a ticket whose classification never finished', () => {
    expect(isEligibleForAutoAssign({ ...baseTicket, ai_confidence: null }, cutoff)).toBe(false);
  });

  it('excludes Manual Review / ESCALATED / Declined states', () => {
    for (const status of ['Manual Review', 'ESCALATED', 'Declined', 'Assigned']) {
      expect(isEligibleForAutoAssign({ ...baseTicket, status }, cutoff)).toBe(false);
    }
  });

  it('excludes deleted tickets', () => {
    expect(isEligibleForAutoAssign({ ...baseTicket, deleted_at: '2026-01-01T00:00:00Z' }, cutoff)).toBe(false);
  });

  it('excludes tickets already flagged for no provider', () => {
    expect(isEligibleForAutoAssign({ ...baseTicket, no_provider_flagged_at: '2026-01-01T00:00:00Z' }, cutoff)).toBe(false);
  });

  it('excludes tickets already auto-assigned', () => {
    expect(isEligibleForAutoAssign({ ...baseTicket, auto_assigned_at: '2026-01-01T00:00:00Z' }, cutoff)).toBe(false);
  });

  it('excludes tickets created after the per-priority cutoff (still within delay)', () => {
    expect(isEligibleForAutoAssign({ ...baseTicket, created_at: new Date(Date.now() + 1000).toISOString() }, cutoff)).toBe(false);
  });

  it('treats null/missing ticket as ineligible, never throws', () => {
    expect(isEligibleForAutoAssign(null, cutoff)).toBe(false);
    expect(isEligibleForAutoAssign(undefined, cutoff)).toBe(false);
  });

  it('only auto-assigns from the green-listed statuses', () => {
    expect(AUTO_ASSIGNED_STATUSES).toEqual(['New', 'Open', 'AI Classified']);
    for (const status of AUTO_ASSIGNED_STATUSES) {
      expect(isEligibleForAutoAssign({ ...baseTicket, status }, cutoff)).toBe(true);
    }
  });
});