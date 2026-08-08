import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import config from './config/index.js';
import { unauthLimiter, authLimiter } from './middleware/rateLimiter.js';
import tlsEnforcer from './middleware/tlsEnforcer.js';
import sanitize from './middleware/sanitize.js';
import { doubleCsrfProtection, generateToken } from './middleware/csrf.js';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './swagger.js';
import errorHandler, { notFoundHandler } from './middleware/errorHandler.js';
import logger from './shared/utils/logger.js';

import authRoutes from './modules/auth/auth.routes.js';
import ticketsRoutes from './modules/tickets/tickets.routes.js';
import propertiesRoutes from './modules/properties/properties.routes.js';
import unitsRoutes from './modules/units/units.routes.js';
import techniciansRoutes from './modules/technicians/technicians.routes.js';
import categoriesRoutes from './modules/categories/categories.routes.js';
import notificationsRoutes from './modules/notifications/notifications.routes.js';
import messagesRoutes from './modules/messages/messages.routes.js';
import documentsRoutes from './modules/documents/documents.routes.js';
import settingsRoutes from './modules/settings/settings.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';
import managersRoutes from './modules/managers/managers.routes.js';
import tenantsRoutes from './modules/tenants/tenants.routes.js';
import providersRoutes from './modules/providers/providers.routes.js';
import reportsRoutes from './modules/reports/reports.routes.js';
import analyticsRoutes from './modules/analytics/analytics.routes.js';
import auditRoutes from './modules/audit/audit.routes.js';
import backupRoutes from './modules/backup/backup.routes.js';

import commentsRoutes from './modules/comments/comments.routes.js';
import profileRoutes from './modules/profile/profile.routes.js';
import dashboardRoutes from './modules/dashboard/dashboard.routes.js';
import searchRoutes from './modules/search/search.routes.js';
import helpRoutes from './modules/help/help.routes.js';
import systemRoutes from './modules/system/system.routes.js';
import logsRoutes from './modules/logs/logs.routes.js';
import statisticsRoutes from './modules/statistics/statistics.routes.js';
import permissionsRoutes from './modules/permissions/permissions.routes.js';
import rolesRoutes from './modules/roles/roles.routes.js';
import usersRoutes from './modules/users/users.routes.js';
import uploadsRoutes from './modules/uploads/uploads.routes.js';
import superAdminRoutes from './modules/super-admin/super-admin.routes.js';
import serviceProvidersRoutes from './modules/service-providers/service-providers.routes.js';

/* New modules */
import leasesRoutes from './modules/leases/leases.routes.js';
import invoicesRoutes from './modules/invoices/invoices.routes.js';
import paymentsRoutes from './modules/payments/payments.routes.js';
import calendarRoutes from './modules/calendar/calendar.routes.js';
import activityRoutes from './modules/activity/activity.routes.js';
import realtimeRoutes from './modules/realtime/realtime.routes.js';
import notificationPreferencesRoutes from './modules/notification-preferences/notification-preferences.routes.js';
import aiRoutes from './modules/ai/ai.routes.js';
import routingRoutes from './modules/routing/routing.routes.js';

/* Ratings Feature */
import ratingsRoutes from './modules/ratings/ratings.routes.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  strictTransportSecurity: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  permissionsPolicy: {
    features: {
      camera: ["'none'"],
      microphone: ["'none'"],
      geolocation: ["'none'"],
    },
  },
}));
app.use(cors({ origin: config.cors.origin, credentials: true }));
app.use(cookieParser());
app.use(tlsEnforcer);
app.use(unauthLimiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(sanitize);
app.use(morgan(config.nodeEnv === 'development' ? 'dev' : 'combined', { stream: { write: msg => logger.info(msg.trim()) } }));

app.get('/api/csrf-token', (req, res) => {
  res.json({ success: true, data: { csrfToken: generateToken(req, res) } });
});

/* Auth routes before CSRF — they use JWT, not session cookies */
app.use('/api/auth', authRoutes);

app.use('/api', doubleCsrfProtection);

/* Authenticated routes get higher rate limit */
app.use('/api', authLimiter);

app.use('/uploads', express.static(path.resolve(__dirname, '..', config.upload.uploadDir)));

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get('/api/health', (req, res) => res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } }));
app.use('/api/tickets', ticketsRoutes);
app.use('/api/properties', propertiesRoutes);
app.use('/api/units', unitsRoutes);
app.use('/api/technicians', techniciansRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/uploads', uploadsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/super-admin', superAdminRoutes);
app.use('/api/managers', managersRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/tenants', tenantsRoutes);
app.use('/api/providers', providersRoutes);
app.use('/api/service-providers', serviceProvidersRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/statistics', statisticsRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/comments', commentsRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/help', helpRoutes);
app.use('/api/permissions', permissionsRoutes);
app.use('/api/roles', rolesRoutes);

/* New routes */
app.use('/api/leases', leasesRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/realtime', realtimeRoutes);
app.use('/api/notification-preferences', notificationPreferencesRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/routing', routingRoutes);

/* ratings feature routes */
app.use('/api/ratings', ratingsRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
