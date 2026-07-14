import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import config from '../../config/index.js';
import logger from '../utils/logger.js';
import { withRetry, isAwsEnabled } from './retry.js';

let secretsCache = {};
let client = null;

function getClient() {
  if (!client) {
    client = new SecretsManagerClient({
      region: config.aws.region,
      credentials: config.aws.accessKeyId && config.aws.secretAccessKey
        ? { accessKeyId: config.aws.accessKeyId, secretAccessKey: config.aws.secretAccessKey }
        : undefined,
    });
  }
  return client;
}

async function loadSecrets() {
  if (!isAwsEnabled()) {
    if (config.nodeEnv === 'production') {
      logger.warn('AWS disabled — using env-based secrets in production');
    }
    return;
  }

  const secretNames = [
    config.aws.secrets.jwtName || 'SPMT_JWT_SECRET',
    config.aws.secrets.dbName || 'SPMT_DB_URL',
  ];

  for (const name of secretNames) {
    const result = await withRetry(async ({ signal }) => {
      const cmd = new GetSecretValueCommand({ SecretId: name });
      const data = await getClient().send(cmd, { abortSignal: signal });
      let value = data.SecretString;
      try { value = JSON.parse(value); } catch { }
      return { name, value };
    }, { operation: `secrets:${name}` });

    if (result.success) {
      secretsCache[result.result.name] = result.result.value;
      logger.info(`Loaded secret: ${result.result.name}`);
    } else {
      logger.warn(`Failed to load secret ${name}, using env fallback: ${result.error}`);
    }
  }
}

function get(key, fallback = null) {
  return secretsCache[key] || process.env[key] || fallback;
}

export { loadSecrets, get };
