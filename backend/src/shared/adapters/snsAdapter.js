import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import config from '../../config/index.js';
import logger from '../utils/logger.js';
import { withRetry, isAwsEnabled } from './retry.js';
import { query } from '../../db/connection.js';

let client = null;

function getClient() {
  if (!client) {
    client = new SNSClient({
      region: config.aws.region,
      credentials: config.aws.accessKeyId && config.aws.secretAccessKey
        ? { accessKeyId: config.aws.accessKeyId, secretAccessKey: config.aws.secretAccessKey }
        : undefined,
    });
  }
  return client;
}

async function sendPush(platformEndpointArn, payload) {
  if (!isAwsEnabled()) {
    logger.info(`[DEV SNS PUSH] Endpoint: ${platformEndpointArn} | Payload: ${JSON.stringify(payload)}`);
    try {
      await query(
        `INSERT INTO notifications (user_id, title, body, delivery_status) VALUES (NULL, $1, $2, 'SIMULATED')`,
        [payload.title || 'Push Notification', payload.body || JSON.stringify(payload)]
      );
    } catch { }
    return { success: true, service: 'dev' };
  }

  const result = await withRetry(async ({ signal }) => {
    const cmd = new PublishCommand({
      TargetArn: platformEndpointArn,
      Message: JSON.stringify(payload),
      MessageStructure: 'json',
    });
    const resp = await getClient().send(cmd, { abortSignal: signal });
    return resp.MessageId;
  }, { operation: 'sns:sendPush' });

  if (result.success) return { success: true, messageId: result.result };
  logger.error(`SNS push failed: ${result.error}`);
  return { success: false, error: result.error };
}

async function sendSms(phoneNumberE164, message, isEmergency = false) {
  if (!isAwsEnabled()) {
    logger.info(`[DEV SNS SMS] To: ${phoneNumberE164} | Body: ${message} | Emergency: ${isEmergency}`);
    try {
      await query(
        `INSERT INTO notifications (user_id, title, body, delivery_status) VALUES (NULL, $1, $2, 'SIMULATED')`,
        ['SMS Notification', message]
      );
    } catch { }
    return { success: true, service: 'dev' };
  }

  const result = await withRetry(async ({ signal }) => {
    const cmd = new PublishCommand({
      PhoneNumber: phoneNumberE164,
      Message: message,
      MessageAttributes: isEmergency ? {
        'AWS.SNS.SMS.SMSType': {
          DataType: 'String',
          StringValue: 'Transactional',
        },
      } : undefined,
    });
    const resp = await getClient().send(cmd, { abortSignal: signal });
    return resp.MessageId;
  }, { operation: 'sns:sendSms' });

  if (result.success) return { success: true, messageId: result.result };
  logger.error(`SNS SMS failed for ${phoneNumberE164}: ${result.error}`);
  return { success: false, error: result.error };
}

async function publishTopic(subject, message) {
  if (!isAwsEnabled()) {
    logger.info(`[DEV SNS TOPIC] Subject: ${subject} | Message: ${message}`);
    try {
      await query(
        `INSERT INTO notifications (user_id, title, body, delivery_status) VALUES (NULL, $1, $2, 'SIMULATED')`,
        [subject, message]
      );
    } catch { }
    return { success: true, service: 'dev' };
  }

  const topicArn = config.aws.sns.topicArn;
  if (!topicArn) {
    logger.error('SNS topic ARN not configured');
    return { success: false, error: 'SNS_TOPIC_ARN_NOT_CONFIGURED' };
  }

  const isFifo = topicArn.endsWith('.fifo');
  const result = await withRetry(async ({ signal }) => {
    const cmd = new PublishCommand({
      TopicArn: topicArn,
      Subject: subject,
      Message: message,
      ...(isFifo && { MessageGroupId: 'emergency-tickets' }),
    });
    const resp = await getClient().send(cmd, { abortSignal: signal });
    return resp.MessageId;
  }, { operation: 'sns:publishTopic' });

  if (result.success) return { success: true, messageId: result.result };
  logger.error(`SNS topic publish failed: ${result.error}`);
  return { success: false, error: result.error };
}

export { sendPush, sendSms, publishTopic };
