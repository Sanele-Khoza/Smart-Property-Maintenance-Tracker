import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import config from '../../config/index.js';
import logger from '../utils/logger.js';
import { withRetry, isAwsEnabled } from './retry.js';

let client = null;

function getClient() {
  if (!client) {
    client = new S3Client({
      region: config.aws.region,
      credentials: config.aws.accessKeyId && config.aws.secretAccessKey
        ? { accessKeyId: config.aws.accessKeyId, secretAccessKey: config.aws.secretAccessKey }
        : undefined,
    });
  }
  return client;
}

async function uploadFile(buffer, key, contentType, bucket) {
  if (!isAwsEnabled()) return null;

  const result = await withRetry(async ({ signal }) => {
    const cmd = new PutObjectCommand({
      Bucket: bucket || config.aws.s3.imagesBucket,
      Key: key,
      Body: buffer,
      ContentType: contentType || 'application/octet-stream',
      ServerSideEncryption: 'AES256',
    });
    await getClient().send(cmd, { abortSignal: signal });
    return key;
  }, { operation: 's3:uploadFile' });

  return result.success ? result.result : null;
}

async function getPresignedUrl(key, bucket, ttlSeconds) {
  if (!isAwsEnabled()) return null;

  const result = await withRetry(async ({ signal }) => {
    const cmd = new GetObjectCommand({
      Bucket: bucket || config.aws.s3.imagesBucket,
      Key: key,
    });
    return await getSignedUrl(getClient(), cmd, { expiresIn: ttlSeconds || config.aws.s3.presignedUrlTtlImages });
  }, { operation: 's3:presignedUrl' });

  return result.success ? result.result : null;
}

async function deleteFile(key, bucket) {
  if (!isAwsEnabled()) return false;

  const result = await withRetry(async ({ signal }) => {
    const cmd = new DeleteObjectCommand({
      Bucket: bucket || config.aws.s3.imagesBucket,
      Key: key,
    });
    await getClient().send(cmd, { abortSignal: signal });
    return true;
  }, { operation: 's3:deleteFile' });

  return result.success;
}

export { uploadFile, getPresignedUrl, deleteFile };
