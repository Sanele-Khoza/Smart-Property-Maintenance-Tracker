import * as notificationsRepo from '../../modules/notifications/notifications.repository.js';
import { sendNotificationEmail } from './email.service.js';
import { sendToUser, broadcast } from './sse.js';
import * as audit from './securityAudit.js';

async function notifyUserStatusChange({
  userId,
  userEmail,
  userName,
  action,
  title,
  body,
  performedBy = null,
  ipAddress = null,
  severity = audit.SEVERITY.WARN,
}) {
  await audit.log(action, body, performedBy, ipAddress, severity);

  const notification = await notificationsRepo
    .create({ user_id: userId, type: action.toLowerCase(), title, body })
    .catch(() => null);

  if (userEmail) {
    sendNotificationEmail(userEmail, userName || '', { title, body }).catch(() => {});
  }

  sendToUser(userId, 'user:status-changed', {
    userId,
    action,
    title,
    body,
    notificationId: notification?.id || null,
    at: new Date().toISOString(),
  });

  broadcast('users:changed', {
    userId,
    action,
    at: new Date().toISOString(),
  });

  return notification;
}

export { notifyUserStatusChange };
