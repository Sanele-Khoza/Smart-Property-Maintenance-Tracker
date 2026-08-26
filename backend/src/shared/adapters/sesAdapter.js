import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import nodemailer from 'nodemailer';
import config from '../../config/index.js';
import logger from '../utils/logger.js';
import { withRetry, isAwsEnabled } from './retry.js';

let sesClient = null;
let gmailTransporter = null;
let etherealTransporter = null;
let etherealAccount = null;

function getSesClient() {
  if (!sesClient) {
    sesClient = new SESClient({
      region: config.aws?.ses?.region || config.aws?.region,
      credentials:
        config.aws?.accessKeyId && config.aws?.secretAccessKey
          ? {
              accessKeyId: config.aws.accessKeyId,
              secretAccessKey: config.aws.secretAccessKey,
            }
          : undefined,
    });
  }
  return sesClient;
}

function getGmailTransporter() {
  if (gmailTransporter) return gmailTransporter;

  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!user || !pass) return null;

  gmailTransporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: false,
    auth: { user, pass },
  });

  return gmailTransporter;
}

async function getEtherealTransporter() {
  if (etherealTransporter) return etherealTransporter;

  etherealAccount = await nodemailer.createTestAccount();
  etherealTransporter = nodemailer.createTransport({
    host: etherealAccount.smtp.host,
    port: etherealAccount.smtp.port,
    secure: etherealAccount.smtp.secure,
    auth: {
      user: etherealAccount.user,
      pass: etherealAccount.pass,
    },
  });

  console.log('\n══════════════════════════════════════════════');
  console.log('  ETHEREAL TEST EMAIL ACCOUNT CREATED');
  console.log(`  User: ${etherealAccount.user}`);
  console.log(`  Pass: ${etherealAccount.pass}`);
  console.log('══════════════════════════════════════════════\n');

  return etherealTransporter;
}

async function sendEmail({ to, subject, text, html }) {
  const recipients = Array.isArray(to) ? to : [to];
  const from = process.env.EMAIL_FROM || process.env.EMAIL_USER || '"SPMT System" <noreply@spmt.local>';

  // ---------- 1. Real Gmail ----------
  const gmail = getGmailTransporter();
  if (gmail) {
    try {
      const info = await gmail.sendMail({
        from,
        to: recipients.join(', '),
        subject,
        text: text || undefined,
        html: html || undefined,
      });

      console.log('\n══════════════════════════════════════════════');
      console.log('  REAL EMAIL SENT (Gmail)');
      console.log(`  To:      ${recipients.join(', ')}`);
      console.log(`  Subject: ${subject}`);
      console.log(`  MessageId: ${info.messageId}`);
      console.log('══════════════════════════════════════════════\n');

      return { success: true, messageId: info.messageId };
    } catch (err) {
      logger.error(`Gmail sendEmail failed: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  // ---------- 2. AWS SES ----------
  if (isAwsEnabled()) {
    const params = {
      Source: config.aws.ses.fromAddress,
      Destination: { ToAddresses: recipients },
      Message: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: html
          ? { Html: { Data: html, Charset: 'UTF-8' } }
          : { Text: { Data: text || '', Charset: 'UTF-8' } },
      },
    };

    if (config.aws?.ses?.configurationSet) {
      params.ConfigurationSetName = config.aws.ses.configurationSet;
    }

    const result = await withRetry(
      async ({ signal }) => {
        const cmd = new SendEmailCommand(params);
        const resp = await getSesClient().send(cmd, { abortSignal: signal });
        return resp.MessageId;
      },
      { operation: 'ses:sendEmail' }
    );

    if (result.success) return { success: true, messageId: result.result };
    logger.error(`SES sendEmail failed: ${result.error}`);
    return { success: false, error: result.error };
  }

  // ---------- 3. Ethereal fallback ----------
  try {
    const transporter = await getEtherealTransporter();
    const info = await transporter.sendMail({
      from: '"SPMT System" <noreply@spmt.local>',
      to: recipients.join(', '),
      subject,
      text: text || undefined,
      html: html || undefined,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    console.log('\n══════════════════════════════════════════════');
    console.log('  EMAIL SENT (Ethereal test)');
    console.log(`  To:      ${recipients.join(', ')}`);
    console.log(`  Subject: ${subject}`);
    console.log(`  Preview: ${previewUrl}`);
    console.log('══════════════════════════════════════════════\n');

    return { success: true, messageId: info.messageId, previewUrl };
  } catch (err) {
    logger.error(`Ethereal sendEmail failed: ${err.message}`);
    return { success: false, error: err.message };
  }
}

export { sendEmail };