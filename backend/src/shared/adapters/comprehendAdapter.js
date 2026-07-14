import { ComprehendClient, ClassifyDocumentCommand } from '@aws-sdk/client-comprehend';
import config from '../../config/index.js';
import logger from '../utils/logger.js';
import { withRetry, isAwsEnabled } from './retry.js';
import keywordClassify from '../utils/keywordClassifier.js';

let client = null;

function getClient() {
  if (!client) {
    client = new ComprehendClient({
      region: config.aws.region,
      credentials: config.aws.accessKeyId && config.aws.secretAccessKey
        ? { accessKeyId: config.aws.accessKeyId, secretAccessKey: config.aws.secretAccessKey }
        : undefined,
    });
  }
  return client;
}

function truncateToBytes(text, maxBytes) {
  const encoder = new TextEncoder();
  let encoded = encoder.encode(text);
  if (encoded.length <= maxBytes) return text;
  const decoder = new TextDecoder('utf-8', { fatal: false });
  while (encoded.length > maxBytes) {
    text = text.slice(0, -1);
    encoded = encoder.encode(text);
  }
  return text;
}

function mapComprehendLabels(labels) {
  const SDD_CATEGORIES = [
    'Plumbing', 'Electrical', 'HVAC', 'Appliances',
    'Structural', 'Security', 'Landscaping', 'Pest Control', 'Other',
  ];
  if (!labels || labels.length === 0) return { category: 'Other', confidence: 0.15 };

  const sorted = [...labels].sort((a, b) => (b.Score || 0) - (a.Score || 0));
  const top = sorted[0];
  const name = top.Name || 'Other';
  const confidence = Math.round(Math.max(top.Score || 0, 0.15) * 100) / 100;

  const match = SDD_CATEGORIES.find(c => c.toLowerCase() === name.toLowerCase());
  return { category: match || 'Other', confidence };
}

async function classifyText(text) {
  if (!text || text.trim().length < 5) {
    return { category: 'Other', confidence: 0.1, service: 'KEYWORD_FALLBACK' };
  }

  if (!isAwsEnabled() || !config.aws.comprehend?.endpointArn) {
    const fallback = keywordClassify(text);
    fallback.service = 'KEYWORD_FALLBACK';
    return fallback;
  }

  const truncated = truncateToBytes(text, 5000);
  if (truncated.length !== text.length) {
    logger.warn(`Comprehend text truncated from ${text.length} to ${truncated.length} chars (5000 byte limit)`);
  }

  const result = await withRetry(async ({ signal }) => {
    const cmd = new ClassifyDocumentCommand({
      Text: truncated,
      EndpointArn: config.aws.comprehend.endpointArn,
    });
    const response = await getClient().send(cmd, { abortSignal: signal });
    return mapComprehendLabels(response.Classes || response.Labels);
  }, { operation: 'comprehend:classifyDocument', timeoutMs: 4000 });

  if (result.success) {
    return { ...result.result, service: 'COMPREHEND' };
  }

  const fallback = keywordClassify(text);
  fallback.service = 'KEYWORD_FALLBACK';
  logger.warn(`Comprehend failed, using keyword fallback: ${result.error}`);
  return fallback;
}

export { classifyText };
