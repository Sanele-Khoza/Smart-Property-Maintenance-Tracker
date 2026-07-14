import { RekognitionClient, DetectModerationLabelsCommand, DetectLabelsCommand } from '@aws-sdk/client-rekognition';
import config from '../../config/index.js';
import logger from '../utils/logger.js';
import { withRetry, isAwsEnabled } from './retry.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const labelCategoryMap = require('../utils/labelCategoryMap.json');

let client = null;

function getClient() {
  if (!client) {
    client = new RekognitionClient({
      region: config.aws.region,
      credentials: config.aws.accessKeyId && config.aws.secretAccessKey
        ? { accessKeyId: config.aws.accessKeyId, secretAccessKey: config.aws.secretAccessKey }
        : undefined,
    });
  }
  return client;
}

async function moderateImage(fileBuffer) {
  if (!isAwsEnabled()) {
    return { safe: true, labels: [] };
  }

  const result = await withRetry(async ({ signal }) => {
    const cmd = new DetectModerationLabelsCommand({
      Image: { Bytes: fileBuffer },
      MinConfidence: 70,
    });
    const response = await getClient().send(cmd, { abortSignal: signal });
    const unsafeLabels = (response.ModerationLabels || [])
      .filter(l => l.Confidence >= 70)
      .map(l => l.Name);
    return { safe: unsafeLabels.length === 0, labels: unsafeLabels };
  }, { operation: 'rekognition:moderateImage', timeoutMs: 3000 });

  if (result.success) return result.result;
  return { safe: true, labels: [], rekognitionError: result.error };
}

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
  };
}

async function detectLabels(fileBuffer) {
  if (!isAwsEnabled()) {
    return null;
  }

  const moderationResult = await moderateImage(fileBuffer);
  if (!moderationResult.safe) {
    logger.warn(`Image rejected by moderation: ${moderationResult.labels.join(', ')}`);
    return null;
  }

  const result = await withRetry(async ({ signal }) => {
    const cmd = new DetectLabelsCommand({
      Image: { Bytes: fileBuffer },
      MaxLabels: 20,
      MinConfidence: 60,
    });
    const response = await getClient().send(cmd, { abortSignal: signal });
    const labels = (response.Labels || []).map(l => ({
      name: l.Name,
      confidence: Math.round(l.Confidence / 100 * 100) / 100,
      categories: l.Categories?.map(c => c.Name) || [],
    }));
    const labelNames = labels.map(l => l.name);
    const mapped = mapLabelsToCategory(labelNames);
    return { ...mapped, labels: labelNames, rawLabels: labels, service: 'REKOGNITION' };
  }, { operation: 'rekognition:detectLabels', timeoutMs: 3000 });

  return result.success ? result.result : null;
}

export { moderateImage, detectLabels };
