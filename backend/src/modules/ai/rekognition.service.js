import { detectLabels as detectLabelsAws } from '../../shared/adapters/rekognitionAdapter.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const labelCategoryMap = require('../../shared/utils/labelCategoryMap.json');

const ABNORMAL_LABELS = [
  'Water Damage', 'Mold', 'Fire Damage', 'Crack', 'Rust', 'Corrosion',
  'Broken', 'Leak', 'Spill', 'Smoke', 'Damage', 'Dent', 'Stain',
  'Overflow', 'Flood', 'Debris', 'Worn Out',
];

function mapLabelsToCategory(labelNames) {
  const inverted = {};
  for (const [category, keywords] of Object.entries(labelCategoryMap)) {
    for (const kw of keywords) {
      inverted[kw.toLowerCase()] = category;
    }
  }

  const lowerLabels = labelNames.map(l => l.toLowerCase());
  const scores = {};
  for (const category of Object.keys(labelCategoryMap)) {
    scores[category] = 0;
  }

  for (const label of lowerLabels) {
    for (const [kw, category] of Object.entries(inverted)) {
      if (label.includes(kw) || kw.includes(label)) {
        scores[category] = (scores[category] || 0) + 1;
      }
    }
  }

  let bestCat = 'Other';
  let bestScore = 0;
  for (const [cat, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestCat = cat;
    }
  }

  const confidence = Math.min(bestScore / 3, 1);
  return {
    category: bestScore > 0 ? bestCat : 'Other',
    confidence: Math.round(Math.max(confidence, 0.15) * 100) / 100,
    abnormalDetected: Object.values(scores).some(s => s > 0) && labelNames.some(l =>
      ABNORMAL_LABELS.some(a => l.toLowerCase().includes(a.toLowerCase()))
    ),
    service: 'REKOGNITION',
  };
}

function isVisualEmergency(detectedCategory, labels) {
  const abnormalLabels = ABNORMAL_LABELS.filter(a =>
    labels.some(l => l.name?.toLowerCase().includes(a.toLowerCase()))
  );
  if (abnormalLabels.length >= 2) return true;
  if (detectedCategory === 'Plumbing' && labels.some(l => l.name?.toLowerCase().includes('water') || l.name?.toLowerCase().includes('leak'))) return true;
  if (detectedCategory === 'Electrical' && labels.some(l => l.name?.toLowerCase().includes('fire') || l.name?.toLowerCase().includes('smoke'))) return true;
  return false;
}

async function analyzeImage(imageBuffer) {
  const result = await detectLabelsAws(imageBuffer);
  if (!result) {
    return { category: null, confidence: 0, service: 'none', visualEmergency: false, labels: [] };
  }
  return {
    ...result,
    visualEmergency: isVisualEmergency(result.category, result.rawLabels || []),
  };
}

export { analyzeImage, detectLabelsAws as detectLabels, mapLabelsToCategory, isVisualEmergency };
