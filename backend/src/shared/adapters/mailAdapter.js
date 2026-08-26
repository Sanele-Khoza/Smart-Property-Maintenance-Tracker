import nodemailer from 'nodemailer';
import config from '../../config/index.js';
import logger from '../utils/logger.js';

let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: config.smtp.user
        ? { user: config.smtp.user, pass: config.smtp.pass }
        : undefined,
      tls: { rejectUnauthorized: false },
    });
  }
  return transporter;
}

async function sendMail({ to, subject, text, html }) {
  try {
    const info = await getTransporter().sendMail({
      from: config.mail.from,
      to,
      subject,
      text: text || subject,
      html: html || text || subject,
    });
    logger.info(`Email sent via SMTP to ${to}: ${subject} (messageId: ${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    logger.error(`SMTP sendMail failed for ${to}: ${err.message}`);
    return { success: false, error: err.message };
  }
}

export { sendMail };
