import winston from 'winston';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import config from '../../config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  defaultMeta: { service: 'spmt-api' },
  transports: [
    new winston.transports.File({
      filename: join(__dirname, '../../../logs/error.log'),
      level: 'error',
      maxsize: 5242880,
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: join(__dirname, '../../../logs/combined.log'),
      maxsize: 5242880,
      maxFiles: 5,
    }),
  ],
  exitOnError: false,
});

if (process.env.NODE_ENV === 'production' && config.aws.enabled) {
  import('./cloudwatchTransport.js').then(({ default: CloudWatchTransport }) => {
    logger.add(new CloudWatchTransport({
      level: process.env.CLOUDWATCH_LOG_LEVEL || 'info',
      logGroupName: `/spmt/api/${config.nodeEnv}`,
    }));
  }).catch(() => {});
}

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
        const metaStr = Object.keys(meta).length > 1 ? ` ${JSON.stringify(meta)}` : '';
        if (stack) {
          return `${timestamp} [${level}]: ${message}\n${stack}${metaStr}`;
        }
        return `${timestamp} [${level}]: ${message}${metaStr}`;
      }),
    ),
  }));
}

export default logger;
