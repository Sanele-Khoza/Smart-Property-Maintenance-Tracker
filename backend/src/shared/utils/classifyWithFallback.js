/*
 * Tandem text classifier (SPMT Python AI + AWS Comprehend).
 *
 * When the SPMT Python classifier returns a LOW confidence (below threshold),
 * we consult AWS Comprehend as a second opinion and use whichever is more
 * confident. This gives the tenant a more reliable category than trusting a
 * single, uncertain model.
 *
 * Flow:
 *   1. Run Python classifier (when enabled).
 *   2. If Python is confident (>= threshold) → return it, no AWS call.
 *   3. Otherwise run Comprehend and compare; keep the higher-confidence guess.
 *
 * Returns { category, confidence, service, source } where:
 *   - service : the overall best source ('PYTHON_SKLEARN' | 'COMPREHEND' |
 *               'KEYWORD_FALLBACK' | ...)
 *   - source  : a senior decision string e.g. 'PYTHON' | 'COMPREHEND' |
 *               'PYTHON+COMPREHEND-COMPREHEND' (which note won).
 */

import config from '../../config/index.js';
import logger from '../utils/logger.js';
import { classifyText as pythonClassifyText } from '../adapters/pythonAiClient.js';
import { classifyText as comprehendClassifyText } from '../adapters/comprehendAdapter.js';

/**
 * @returns {Promise<{category, confidence, service, source}>}
 */
async function classifyTextWithFallback(text) {
  if (!text || text.trim().length < 5) {
    return { category: 'Other', confidence: 0.1, service: 'NONE', source: 'NONE' };
  }

  const threshold = config.ai.textConfidenceThreshold || 0.6;
  const pythonEnabled = !!config.pythonAi?.enabled;

  /* ── Step 1: run the SPMT Python classifier (primary) ── */
  const python = pythonEnabled
    ? await pythonClassifyText(text)
    : { category: null, confidence: 0, service: 'NONE' };

  // Python is real (not keyword-degraded) and confident → done, no AWS call.
  const pythonReal = python.service === 'PYTHON_SKLEARN';
  if (pythonReal && python.confidence >= threshold) {
    return { ...python, source: 'PYTHON' };
  }

  /* ── Step 2: second opinion from AWS Comprehend ── */
  let comprehend = null;
  try {
    comprehend = await comprehendClassifyText(text);
  } catch (err) {
    logger.warn(`Comprehend fallback failed: ${err.message}`);
  }

  // Comprehend returned a real AWS result (not keyword-degraded).
  const comprehendReal = comprehend?.service === 'COMPREHEND';

  // Both unavailable / degraded → use the best we have.
  if (!pythonReal && !comprehendReal) {
    const best = python.confidence >= (comprehend?.confidence || 0) ? python : comprehend;
    return { ...best, source: pythonReal ? 'PYTHON' : comprehend ? 'COMPREHEND' : 'NONE' };
  }

  // Choose whichever is more confident between real Python and real Comprehend.
  const pyConf = pythonReal ? python.confidence : 0;
  const compConf = comprehendReal ? (comprehend.confidence || 0) : 0;

  if (compConf > pyConf) {
    return { ...comprehend, source: 'COMPREHEND (win by confidence over low Python)' };
  }

  // Python was low but still beat Comprehend (e.g. Comprehend also low/unavailable).
  return { ...python, source: 'PYTHON (retained after Comprehend second opinion)' };
}

export default classifyTextWithFallback;