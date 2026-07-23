import winston from 'winston';
import { CloudWatchLogsClient, PutLogEventsCommand, CreateLogStreamCommand, DescribeLogStreamsCommand } from '@aws-sdk/client-cloudwatch-logs';
import config from '../../config/index.js';

class CloudWatchTransport extends winston.Transport {
  constructor(opts = {}) {
    super(opts);
    this.logGroupName = opts.logGroupName || '/spmt/api';
    this.logStreamName = opts.logStreamName || `api-${new Date().toISOString().slice(0, 10)}-${process.pid}`;
    this.sequenceToken = null;
    this.pending = [];
    this.flushing = false;

    this.client = new CloudWatchLogsClient({
      region: opts.region || config.aws.region,
      credentials: config.aws.accessKeyId
        ? { accessKeyId: config.aws.accessKeyId, secretAccessKey: config.aws.secretAccessKey }
        : undefined,
    });
  }

  async log(info, callback) {
    try {
      const entry = {
        timestamp: new Date(info.timestamp || Date.now()).getTime(),
        message: JSON.stringify({
          level: info.level,
          message: info.message,
          ...(info.stack ? { stack: info.stack } : {}),
          ...(info.meta || {}),
        }),
      };
      this.pending.push(entry);
      if (!this.flushing) {
        this.flushing = true;
        setImmediate(() => this.flush());
      }
    } catch {}
    callback();
  }

  async flush() {
    if (this.pending.length === 0) {
      this.flushing = false;
      return;
    }
    const batch = this.pending.splice(0, 25);
    try {
      await this.ensureStreamExists();
      const params = {
        logGroupName: this.logGroupName,
        logStreamName: this.logStreamName,
        logEvents: batch,
      };
      if (this.sequenceToken) params.sequenceToken = this.sequenceToken;
      const result = await this.client.send(new PutLogEventsCommand(params));
      this.sequenceToken = result.nextSequenceToken;
    } catch (err) {
      if (err.name === 'InvalidSequenceTokenException' && err.expectedSequenceToken) {
        this.sequenceToken = err.expectedSequenceToken;
        this.pending.unshift(...batch);
      } else if (err.name === 'DataAlreadyAcceptedException') {
      } else if (err.name === 'ResourceNotFoundException') {
        this.sequenceToken = null;
        this.pending.unshift(...batch);
      }
    }
    this.flushing = false;
    if (this.pending.length > 0) setImmediate(() => this.flush());
  }

  async ensureStreamExists() {
    try {
      const desc = await this.client.send(new DescribeLogStreamsCommand({
        logGroupName: this.logGroupName,
        logStreamNamePrefix: this.logStreamName,
      }));
      if (!desc.logStreams || desc.logStreams.length === 0) {
        await this.client.send(new CreateLogStreamCommand({
          logGroupName: this.logGroupName,
          logStreamName: this.logStreamName,
        }));
      }
    } catch (err) {
      if (err.name !== 'ResourceNotFoundException') throw err;
      try {
        const { CreateLogGroupCommand } = await import('@aws-sdk/client-cloudwatch-logs');
        await this.client.send(new CreateLogGroupCommand({ logGroupName: this.logGroupName }));
        await this.client.send(new CreateLogStreamCommand({
          logGroupName: this.logGroupName,
          logStreamName: this.logStreamName,
        }));
      } catch {}
    }
  }
}

export default CloudWatchTransport;
