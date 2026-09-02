/*
 * Client for the Python AI microservice (ai-service/).
 *
 * Provides:
 *   - classifyText(text)   -> { category, confidence, service }
 *   - autoAssign(...)      -> chooses best provider(s) via the Python model
 *   - classifyAndAssign(...)-> both in one call
 *
 * Returns the same shape the existing comprehendAdapter returns so the
 * five-step aiClassifier can consume the Python result transparently.
 */

import config from '../../config/index.js';
import logger from '../utils/logger.js';
import keywordClassify from '../utils/keywordClassifier.js';
import { resolveTicketLocation, loadCandidateProviders } from '../utils/routingScore.js';

async function pythonRequest(path, payload) {
  const { baseUrl, timeoutMs } = config.pythonAi;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Python AI ${path} responded ${res.status}: ${text.slice(0, 200)}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** @returns {Promise<{category, confidence, service}>} */
async function classifyText(text) {
  if (!text || text.trim().length < 5) {
    return { category: 'Other', confidence: 0.1, service: 'PYTHON_NONE' };
  }
  if (!config.pythonAi.enabled) {
    const fallback = keywordClassify(text);
    fallback.service = 'KEYWORD_FALLBACK';
    return fallback;
  }

  try {
    const json = await pythonRequest('/classify', { text });
    const d = json?.data || {};
    return {
      category: d.category || 'Other',
      confidence: Math.round(Math.max(d.confidence || 0, 0.1) * 100) / 100,
      service: 'PYTHON_SKLEARN',
    };
  } catch (err) {
    logger.warn(`Python AI classify failed, using keyword fallback: ${err.message}`);
    const fallback = keywordClassify(text);
    fallback.service = 'KEYWORD_FALLBACK';
    return fallback;
  }
}

/**
 * Score/rank providers using the Python model.
 * @param {Object} ticket      ticket row (uses ai_category || category)
 * @param {Array}  providers   candidate provider rows from DB
 * @param {Object} opts        { category, topN, requireSpecialisation, lat, lng }
 *
 * Matches are returned in the same camelCase shape the Node scorer produces
 * (id/name/totalScore/autoAccept/...) so downstream assignment code is
 * scorer-agnostic.
 */
async function autoAssign(providers, opts = {}) {
  const category = opts.category || 'Other';
  if (!config.pythonAi.enabled || !providers || providers.length === 0) {
    return { success: true, data: { category, matches: [] } };
  }

  const normalized = providers.map((p) => ({
    id: p.id,
    name: p.name,
    company_name: p.company_name,
    rating: p.rating,
    current_workload: p.current_workload,
    current_jobs: p.pa_jobs,
    status: p.status,
    auto_accept: p.auto_accept,
    preferred_radius_km: p.preferred_radius_km,
    specialisations: p.specialisations,
    gps_lat: p.gps_location?.x ?? null,
    gps_lng: p.gps_location?.y ?? null,
  }));

  try {
    const json = await pythonRequest('/auto-assign', {
      category,
      providers: normalized,
      ticket_lat: opts.lat ?? null,
      ticket_lng: opts.lng ?? null,
      require_specialisation: opts.requireSpecialisation !== false,
      top_n: opts.topN || 1,
    });
    return {
      success: true,
      data: {
        category,
        matches: (json?.data?.matches || []).map(toNodeMatch),
      },
    };
  } catch (err) {
    logger.warn(`Python AI auto-assign failed (${err.message}) — returning no matches`);
    return { success: true, data: { category, matches: [] } };
  }
}

/** Python returns snake_case match objects; map to the Node scorer shape. */
function toNodeMatch(m) {
  return {
    id: m.id,
    name: m.name,
    companyName: m.company_name ?? null,
    specialisations: m.specialisations || [],
    rating: m.rating,
    workload: m.workload ?? 0,
    status: m.status,
    autoAccept: !!m.auto_accept,
    totalScore: m.total_score ?? 0,
    specScore: m.spec_score ?? 0,
    ratingScore: m.rating_score ?? 0,
    proximityScore: m.proximity_score ?? 0,
    workloadScore: m.workload_score ?? 0,
  };
}

/**
 * Score a ticket's candidate providers with Python. Prefers the Python model
 * when enabled, otherwise (or on failure) returns [] so the caller falls back
 * to the Node scorer.
 */
async function scoreProvidersWithPython(ticket, opts = {}) {
  if (!config.pythonAi.enabled) return [];
  try {
    const {
      category = 'Other',
      topN = 3,
      requireSpecialisation = true,
    } = opts;

    const { ticketLat, ticketLng } = await resolveTicketLocation(ticket);
    const providers = await loadCandidateProviders(ticket, { requireSpecialisation, category });

    if (!providers || providers.length === 0) return [];

    const result = await autoAssign(providers, {
      category, topN, requireSpecialisation,
      lat: ticketLat, lng: ticketLng,
    });
    return result.data?.matches || [];
  } catch (err) {
    logger.warn(`Python AI scoring failed (${err.message}) — falling back to Node scorer`);
    return [];
  }
}

export { classifyText, autoAssign, scoreProvidersWithPython };
