import config from '../../config/index.js';
import logger from './logger.js';
import { sendEmail as sendSesEmail } from '../adapters/sesAdapter.js';

async function sendEmail({ to, subject, text, html }) {
  if (config.aws.enabled) {
    const sesResult = await sendSesEmail({ to, subject, text, html });
    if (sesResult.success) {
      logger.info(`Email sent via SES to ${to}: ${subject}`);
      return true;
    }
    logger.warn(`SES failed for ${to}, falling back to nodemailer: ${sesResult.error}`);
  }

  if (config.smtp?.user && config.smtp?.pass) {
    try {
      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.default.createTransport({
        host: config.smtp.host,
        port: config.smtp.port || 587,
        secure: config.smtp.secure || false,
        auth: {
          user: config.smtp.user,
          pass: config.smtp.pass,
        },
      });
      await transporter.sendMail({
        from: config.smtp.from || 'noreply@spmt.com',
        to,
        subject,
        text,
        html,
      });
      logger.info(`Email sent to ${to}: ${subject}`);
      return true;
    } catch (err) {
      logger.error(`Failed to send email to ${to}: ${err.message}`);
      return false;
    }
  }

  logger.info(`[DEV EMAIL] To: ${to} | Subject: ${subject} | Body: ${text || html}`);
  return true;
}

async function sendNotificationEmail(userEmail, userName, notification) {
  const subject = notification.title || 'SPMT Notification';
  const text = `${notification.body}\n\nView in app: ${config.appUrl || 'http://localhost:5000'}`;
  const html = `
    <div style="font-family: Arial; max-width: 600px;">
      <h2>${notification.title || 'Notification'}</h2>
      <p>Hi ${userName},</p>
      <p>${notification.body}</p>
      <hr>
      <p style="color: #888;">
        <a href="${config.appUrl || 'http://localhost:5000'}">View in SPMT</a>
      </p>
    </div>
  `;
  return sendEmail({ to: userEmail, subject, text, html });
}

async function sendNewUserRegisteredAlert(user) {
  if (!config.adminEmail) {
    logger.warn('ADMIN_ALERT_EMAIL not set — skipping registration alert');
    return false;
  }

  const roleLabel = {
    TENANT: 'Tenant',
    PROPERTY_MANAGER: 'Property Manager',
    SERVICE_PROVIDER: 'Service Provider',
  }[user.role] || user.role;

  const subject = `New ${roleLabel.toLowerCase()} registered: ${user.name} ${user.surname}`;
  const text = `A new ${roleLabel.toLowerCase()} has registered on SPMT.\n\n` +
    `Role: ${roleLabel}\n` +
    `Name: ${user.name} ${user.surname}\n` +
    `Email: ${user.email}\n` +
    `Phone: ${user.phone || 'N/A'}\n` +
    `Registered at: ${new Date().toISOString()}`;
  const html = `
    <div style="font-family: Arial; max-width: 600px;">
      <h2>New ${roleLabel} Registration</h2>
      <p><strong>Role:</strong> ${roleLabel}</p>
      <p><strong>Name:</strong> ${user.name} ${user.surname}</p>
      <p><strong>Email:</strong> ${user.email}</p>
      <p><strong>Phone:</strong> ${user.phone || 'N/A'}</p>
      <p><strong>Registered at:</strong> ${new Date().toISOString()}</p>
      <hr>
      <p style="color: #888;">
        <a href="${config.appUrl || 'http://localhost:5000'}">View in SPMT admin panel</a>
      </p>
    </div>
  `;

  return sendEmail({ to: config.adminEmail, subject, text, html });
}

export { sendEmail, sendNotificationEmail, sendNewUserRegisteredAlert };