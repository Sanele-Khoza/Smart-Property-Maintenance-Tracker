/*
 * SES email adapter.
 *
 * DKIM signing and domain verification are configured in the AWS Console / Route53 —
 * this adapter only sends. Ensure the domain is verified in SES before use.
 */

import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import config from '../../config/index.js';
import logger from '../utils/logger.js';
import { withRetry, isAwsEnabled } from './retry.js';

let client = null;

function getClient() {
  if (!client) {
    client = new SESClient({
      region: config.aws.ses.region || config.aws.region,
      credentials: config.aws.accessKeyId && config.aws.secretAccessKey
        ? { accessKeyId: config.aws.accessKeyId, secretAccessKey: config.aws.secretAccessKey }
        : undefined,
    });
  }
  return client;
}

async function sendEmail({ to, subject, text, html }) {
  if (!isAwsEnabled()) {
    return { success: false, service: 'disabled' };
  }

  const params = {
    Source: config.aws.ses.fromAddress,
    Destination: { ToAddresses: [to] },
    Message: {
      Subject: { Data: subject, Charset: 'UTF-8' },
      Body: html
        ? { Html: { Data: html, Charset: 'UTF-8' } }
        : { Text: { Data: text || html, Charset: 'UTF-8' } },
    },
  };

  if (config.aws.ses.configurationSet) {
    params.ConfigurationSetName = config.aws.ses.configurationSet;
  }

  const result = await withRetry(async ({ signal }) => {
    const cmd = new SendEmailCommand(params);
    const resp = await getClient().send(cmd, { abortSignal: signal });
    return resp.MessageId;
  }, { operation: 'ses:sendEmail' });

  if (result.success) return { success: true, messageId: result.result };
  logger.error(`SES sendEmail failed: ${result.error}`);
  return { success: false, error: result.error };
}

export { sendEmail };
