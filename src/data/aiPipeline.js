import { getStore, saveToLocalStorage } from './storeCore';

export const runAiPipeline = ({ textResult, imageResult, textConfidence, imageConfidence }) => {
  const store = getStore();
  const textWeight = parseFloat(store.systemSettings.find(s => s.key === 'AI_TEXT_WEIGHT')?.value || 0.40);
  const imageWeight = parseFloat(store.systemSettings.find(s => s.key === 'AI_IMAGE_WEIGHT')?.value || 0.60);
  const emergencyVisualThreshold = parseFloat(store.systemSettings.find(s => s.key === 'AI_EMERGENCY_VISUAL_THRESHOLD')?.value || 0.70);

  let overridePriority = null;

  if (imageResult === 'Emergency' && imageConfidence >= emergencyVisualThreshold) {
    overridePriority = 'EMERGENCY';
  }

  let suggestedCategory = textResult || imageResult;
  let combinedConfidence = (textConfidence || 0) * textWeight + (imageConfidence || 0) * imageWeight;
  let conflictDetected = false;
  let manualReviewRequired = false;

  if (textResult && imageResult && textResult !== imageResult) {
    if (textConfidence < 0.60 || imageConfidence < 0.60) {
      manualReviewRequired = true;
    } else {
      conflictDetected = true;
    }
  }

  return { suggestedCategory, combinedConfidence, conflictDetected, manualReviewRequired, overridePriority };
};

const EMERGENCY_KEYWORDS = ['gas leak', 'gas smell', 'flooding', 'flood', 'fire', 'smoke', 'burst pipe', 'electrical fault', 'carbon monoxide', 'sewage', 'collapse'];

export const simulateAiClassification = (description, hasImages, categories) => {
  const lower = description.toLowerCase();

  const hits = categories.map(cat => ({
    name: cat.name,
    count: cat.aiKeywords.filter(kw => lower.includes(kw.toLowerCase())).length,
  }));
  const best = hits.reduce((a, b) => (a.count >= b.count ? a : b), hits[0]);

  let textResult = best.count > 0 ? best.name : 'General';
  let textConfidence;

  if (EMERGENCY_KEYWORDS.some(kw => lower.includes(kw))) {
    textResult = 'Emergency';
    textConfidence = Math.round((Math.random() * (0.97 - 0.85) + 0.85) * 100) / 100;
  } else if (best.count >= 3) {
    textConfidence = Math.round((Math.random() * (0.97 - 0.82) + 0.82) * 100) / 100;
  } else if (best.count === 2) {
    textConfidence = Math.round((Math.random() * (0.81 - 0.68) + 0.68) * 100) / 100;
  } else if (best.count === 1) {
    textConfidence = Math.round((Math.random() * (0.67 - 0.55) + 0.55) * 100) / 100;
  } else {
    textConfidence = Math.round((Math.random() * (0.59 - 0.40) + 0.40) * 100) / 100;
  }

  let imageResult, imageConfidence;

  if (!hasImages) {
    imageResult = textResult;
    imageConfidence = textConfidence;
  } else {
    const catNames = categories.map(c => c.name);
    imageResult = catNames[Math.floor(Math.random() * catNames.length)];
    imageConfidence = Math.round((Math.random() * (0.95 - 0.50) + 0.50) * 100) / 100;
    if (Math.random() < 0.35) {
      const others = catNames.filter(n => n !== textResult);
      if (others.length > 0) {
        imageResult = others[Math.floor(Math.random() * others.length)];
      }
    }
  }

  return { textResult, textConfidence, imageResult, imageConfidence };
};

export const getInferenceLogs = () => [...getStore().aiInferenceLog];

export const addInferenceLog = (ticketId, adapter, inputType, result, confidence, conflictDetected) => {
  const store = getStore();
  const newEntry = {
    id: `INF-${String(store.aiInferenceLog.length + 1).padStart(3, '0')}`,
    ticketId,
    adapter,
    inputType,
    confidence,
    result,
    latencyMs: Math.floor(Math.random() * 750) + 150,
    timestamp: new Date().toISOString(),
    conflictDetected,
  };
  store.aiInferenceLog.push(newEntry);
  saveToLocalStorage();
  return newEntry;
};
