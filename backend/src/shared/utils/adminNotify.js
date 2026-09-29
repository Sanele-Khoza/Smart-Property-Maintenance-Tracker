/*
 * Fan-out helper: notify every active System Admin about a system-wide
 * event (new registration, account approved/deactivated, property/unit
 * created, tenant assigned to a unit, etc). Same pattern as the
 * tenant-facing ticket-status notifications in tickets.service.js —
 * DB row (so it's there next time they open Notifications, regardless
 * of whether they were online) + live SSE push + best-effort email.
 */
import { query } from '../../db/connection.js';
import * as notificationsRepo from '../../modules/notifications/notifications.repository.js';
import { sendToUser } from './sse.js';
import { sendNotificationEmail } from './email.service.js';
import logger from './logger.js';

async function getActiveAdmins() {
  const result = await query(
    `SELECT id, name, surname, email
     FROM users
     WHERE role = 'SYSTEM_ADMIN' AND deleted_at IS NULL AND status != 'DEACTIVATED'`
  );
  return result.rows;
}

/**
 * Notify every active System Admin.
 * @param {Object} opts
 * @param {string} opts.type - notification type, e.g. 'admin_alert'
 * @param {string} opts.title - short title, e.g. 'New user registered'
 * @param {string} opts.body - full message body
 * @param {string} [opts.sseEvent] - SSE event name for live updates
 * @param {Object} [opts.sseData] - extra payload merged into the SSE push
 * @param {boolean} [opts.isEmergency]
 */
async function notifySystemAdmins({ type = 'admin_alert', title, body, sseEvent = 'admin_alert', sseData = {}, isEmergency = false }) {
  let admins = [];
  try {
    admins = await getActiveAdmins();
  } catch (err) {
    logger.error(`notifySystemAdmins: failed to load admins: ${err.message}`);
    return;
  }

  await Promise.all(admins.map(async (admin) => {
    try {
      await notificationsRepo.create({
        user_id: admin.id,
        type,
        title,
        body,
        is_emergency: isEmergency,
      });
    } catch (err) {
      logger.error(`notifySystemAdmins: failed to persist notification for ${admin.email}: ${err.message}`);
    }

    sendToUser(admin.id, sseEvent, { title, body, ...sseData });

    if (admin.email) {
      sendNotificationEmail(admin.email, admin.name || '', { title, body }).catch(() => {});
    }
  }));
}

export { notifySystemAdmins };
