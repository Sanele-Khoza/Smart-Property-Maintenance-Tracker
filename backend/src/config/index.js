import dotenv from "dotenv";
dotenv.config();

const config = {
  port: parseInt(process.env.PORT, 10) || 5000,
  nodeEnv: process.env.NODE_ENV || "development",
  cors: {
    origin:
      process.env.CORS_ORIGINS ||
      process.env.CORS_ORIGIN ||
      "http://localhost:5173",
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || "24h",
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 200,
    authWindowMs:
      parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
    authMax: parseInt(process.env.AUTH_RATE_LIMIT_MAX, 10) || 10,
  },
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 10 * 1024 * 1024,
    allowedMimeTypes: [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "application/pdf",
      "text/csv",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ],
    uploadDir: process.env.UPLOAD_DIR || "uploads",
  },
  ai: {
    textConfidenceThreshold:
      parseFloat(process.env.AI_TEXT_CONFIDENCE_THRESHOLD) || 0.6,
    emergencyVisualThreshold:
      parseFloat(process.env.AI_EMERGENCY_VISUAL_THRESHOLD) || 0.7,
  },
  aws: {
    enabled: process.env.AWS_ENABLED === "true",
    region: process.env.AWS_REGION || "af-south-1",
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    comprehend: {
      endpointArn: process.env.AWS_COMPREHEND_ENDPOINT_ARN || "",
    },
    rekognition: {
      region: process.env.AWS_REKOGNITION_REGION || "eu-west-1",
    },
    comprehendRegion:
      process.env.AWS_COMPREHEND_REGION ||
      process.env.AWS_REGION ||
      "af-south-1",
    s3: {
      imagesBucket:
        process.env.AWS_S3_BUCKET_IMAGES || "spmt-ticket-images-dev",
      reportsBucket: process.env.AWS_S3_BUCKET_REPORTS || "spmt-reports-dev",
      presignedUrlTtlImages:
        parseInt(process.env.S3_PRESIGNED_URL_TTL_IMAGES_SECONDS, 10) || 900,
      presignedUrlTtlReports:
        parseInt(process.env.S3_PRESIGNED_URL_TTL_REPORTS_SECONDS, 10) || 86400,
    },
    sns: {
      smsSenderId: process.env.AWS_SNS_SMS_SENDER_ID || "SPMT",
      platformAppArnIos: process.env.AWS_SNS_PLATFORM_APP_ARN_IOS || "",
      platformAppArnAndroid: process.env.AWS_SNS_PLATFORM_APP_ARN_ANDROID || "",
    },
    ses: {
      fromAddress: process.env.AWS_SES_FROM_ADDRESS || "noreply@spmt.co.za",
      configurationSet: process.env.AWS_SES_CONFIGURATION_SET || "",
      region: process.env.AWS_SES_REGION || "eu-west-1",
    },
    secrets: {
      jwtName: process.env.AWS_SECRETS_JWT_NAME || "SPMT_JWT_SECRET",
      dbName: process.env.AWS_SECRETS_DB_NAME || "SPMT_DB_URL",
    },
    retry: {
      maxAttempts: parseInt(process.env.AWS_RETRY_MAX_ATTEMPTS, 10) || 3,
      baseDelayMs: parseInt(process.env.AWS_RETRY_BASE_DELAY_MS, 10) || 100,
    },
  },
};

if (!config.jwt.secret) {
  throw new Error(
    "JWT_SECRET environment variable is required and was not set. Refusing to start.",
  );
}

export default config;
