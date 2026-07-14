import config from '../../config/index.js';
import logger from '../utils/logger.js';

export function isAwsEnabled() {
  return config.aws?.enabled === true;
}

export async function withRetry(fn, options = {}) {
  const { maxAttempts = null, baseDelay = null, operation = 'awsOperation', timeoutMs = null } = options;
  const attempts = maxAttempts ?? config.aws?.retry?.maxAttempts ?? 3;
  const delay = baseDelay ?? config.aws?.retry?.baseDelayMs ?? 100;
  const deadline = timeoutMs ? Date.now() + timeoutMs : null;

  if (!isAwsEnabled()) {
    return { success: false, service: 'disabled' };
  }

  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      if (deadline && Date.now() >= deadline) {
        return { success: false, error: 'Timeout exceeded' };
      }
      let result;
      if (timeoutMs) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          result = await Promise.race([
            fn({ signal: controller.signal }),
            new Promise((_, reject) => {
              controller.signal.addEventListener('abort', () => reject(new Error('Timeout')));
            }),
          ]);
        } finally {
          clearTimeout(timer);
        }
      } else {
        result = await fn({});
      }
      return { success: true, result };
    } catch (err) {
      lastError = err;
      logger.warn(`AWS ${operation} attempt ${attempt}/${attempts} failed: ${err.message}`);
      if (attempt < attempts) {
        await new Promise(r => setTimeout(r, delay * Math.pow(2, attempt - 1)));
      }
    }
  }
  logger.error(`AWS ${operation} failed after ${attempts} attempts: ${lastError.message}`);
  return { success: false, error: lastError.message };
}
