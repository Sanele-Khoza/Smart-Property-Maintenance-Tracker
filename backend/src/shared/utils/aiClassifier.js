/*
 * Five-step AI conflict resolution algorithm (BR-006, BR-009, BR-010)
 *
 * Steps:
 *   1. Image emergency visual ≥0.70 → EMERGENCY, skip rest
 *   2. text category === image category → AGREE, combinedConf = 0.4×textConf + 0.6×imgConf, route if ≥0.60
 *   3. text ≠ image AND either <0.60 → MANUAL_REVIEW (not CONFLICT)
 *   4. text ≠ image AND both ≥0.60 → CONFLICT (not MANUAL_REVIEW); image category used as primary
 *   5. AWS unavailable → graceful fallback; both down → MANUAL_REVIEW, SysAdmin alerted
 *
 * Returns: { outcome, primaryCategory, combinedConfidence, textLabel, imageLabel,
 *            textConfidence, imageConfidence, conflictDetected, requiresManualReview }
 */

const CONFIDENCE_THRESHOLD = 0.60;
const VISUAL_EMERGENCY_THRESHOLD = 0.70;

/**
 * @param {Object} textResult  — { category, confidence, service }
 * @param {Object} visualResult — { category, confidence, service }
 * @param {Object} opts — { imageIsEmergency, awsTextAvailable, awsVisualAvailable }
 */
function classify(textResult, visualResult, opts = {}) {
  const {
    imageIsEmergency = false,
    awsTextAvailable = true,
    awsVisualAvailable = true,
  } = opts;

  /* ── Step 1: Image emergency visual ≥0.70 ── */
  if (visualResult && awsVisualAvailable && imageIsEmergency && visualResult.confidence >= VISUAL_EMERGENCY_THRESHOLD) {
    return buildOutcome({
      outcome: 'EMERGENCY',
      primaryCategory: visualResult.category,
      combinedConfidence: visualResult.confidence,
      textLabel: textResult?.category || null,
      imageLabel: visualResult.category,
      textConfidence: textResult?.confidence || 0,
      imageConfidence: visualResult.confidence,
      conflictDetected: false,
      requiresManualReview: false,
      visualEmergency: true,
    });
  }

  /* ── Step 5: AWS unavailable / fallback ── */
  if (!awsTextAvailable && !awsVisualAvailable) {
    /* Both down — emergency escalation if image emergency */
    if (imageIsEmergency && visualResult?.confidence >= VISUAL_EMERGENCY_THRESHOLD) {
      return buildOutcome({
        outcome: 'EMERGENCY',
        primaryCategory: visualResult.category,
        combinedConfidence: visualResult.confidence,
        textLabel: null,
        imageLabel: visualResult.category,
        textConfidence: 0,
        imageConfidence: visualResult.confidence,
        conflictDetected: false,
        requiresManualReview: false,
        visualEmergency: true,
      });
    }
    return buildOutcome({
      outcome: 'MANUAL_REVIEW',
      primaryCategory: null,
      combinedConfidence: 0,
      textLabel: null,
      imageLabel: null,
      textConfidence: 0,
      imageConfidence: 0,
      conflictDetected: false,
      requiresManualReview: true,
      awsUnavailable: true,
    });
  }

  if (!awsTextAvailable && textResult) {
    /* Only text down — use visual result */
    return buildOutcome({
      outcome: visualResult.confidence >= CONFIDENCE_THRESHOLD ? 'AGREE' : 'MANUAL_REVIEW',
      primaryCategory: visualResult.category,
      combinedConfidence: visualResult.confidence,
      textLabel: null,
      imageLabel: visualResult.category,
      textConfidence: 0,
      imageConfidence: visualResult.confidence,
      conflictDetected: false,
      requiresManualReview: visualResult.confidence < CONFIDENCE_THRESHOLD,
    });
  }

  if (!awsVisualAvailable && visualResult) {
    /* Only visual down — use text result */
    return buildOutcome({
      outcome: textResult.confidence >= CONFIDENCE_THRESHOLD ? 'AGREE' : 'MANUAL_REVIEW',
      primaryCategory: textResult.category,
      combinedConfidence: textResult.confidence,
      textLabel: textResult.category,
      imageLabel: null,
      textConfidence: textResult.confidence,
      imageConfidence: 0,
      conflictDetected: false,
      requiresManualReview: textResult.confidence < CONFIDENCE_THRESHOLD,
    });
  }

  if (!textResult || !visualResult) {
    return buildOutcome({
      outcome: 'MANUAL_REVIEW',
      primaryCategory: null,
      combinedConfidence: 0,
      textLabel: textResult?.category || null,
      imageLabel: visualResult?.category || null,
      textConfidence: textResult?.confidence || 0,
      imageConfidence: visualResult?.confidence || 0,
      conflictDetected: false,
      requiresManualReview: true,
    });
  }

  /* ── Step 2: categories match → AGREE ── */
  if (textResult.category === visualResult.category) {
    const combined = 0.4 * textResult.confidence + 0.6 * visualResult.confidence;
    return buildOutcome({
      outcome: combined >= CONFIDENCE_THRESHOLD ? 'AGREE' : 'MANUAL_REVIEW',
      primaryCategory: textResult.category,
      combinedConfidence: combined,
      textLabel: textResult.category,
      imageLabel: visualResult.category,
      textConfidence: textResult.confidence,
      imageConfidence: visualResult.confidence,
      conflictDetected: false,
      requiresManualReview: combined < CONFIDENCE_THRESHOLD,
    });
  }

  /* ── Step 3: differ AND either <0.60 → MANUAL_REVIEW ── */
  if (textResult.confidence < CONFIDENCE_THRESHOLD || visualResult.confidence < CONFIDENCE_THRESHOLD) {
    return buildOutcome({
      outcome: 'MANUAL_REVIEW',
      primaryCategory: visualResult.category,
      combinedConfidence: 0.4 * textResult.confidence + 0.6 * visualResult.confidence,
      textLabel: textResult.category,
      imageLabel: visualResult.category,
      textConfidence: textResult.confidence,
      imageConfidence: visualResult.confidence,
      conflictDetected: false,
      requiresManualReview: true,
    });
  }

  /* ── Step 4: differ AND both ≥0.60 → CONFLICT, image category primary ── */
  return buildOutcome({
    outcome: 'CONFLICT',
    primaryCategory: visualResult.category,
    combinedConfidence: 0.4 * textResult.confidence + 0.6 * visualResult.confidence,
    textLabel: textResult.category,
    imageLabel: visualResult.category,
    textConfidence: textResult.confidence,
    imageConfidence: visualResult.confidence,
    conflictDetected: true,
    requiresManualReview: false,
  });
}

function buildOutcome(data) {
  return {
    outcome: data.outcome,
    primaryCategory: data.primaryCategory,
    combinedConfidence: Math.round(data.combinedConfidence * 100) / 100,
    textLabel: data.textLabel,
    imageLabel: data.imageLabel,
    textConfidence: Math.round(data.textConfidence * 100) / 100,
    imageConfidence: Math.round(data.imageConfidence * 100) / 100,
    conflictDetected: data.conflictDetected,
    requiresManualReview: data.requiresManualReview,
    visualEmergency: data.visualEmergency || false,
    awsUnavailable: data.awsUnavailable || false,
  };
}

export { classify, CONFIDENCE_THRESHOLD, VISUAL_EMERGENCY_THRESHOLD };
