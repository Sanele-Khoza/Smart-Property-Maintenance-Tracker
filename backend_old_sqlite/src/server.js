const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { initializeDatabase } = require('./db/database');
const { seed } = require('./db/seed');
const authRoutes = require('./routes/auth');
const propertyRoutes = require('./routes/properties');
const unitRoutes = require('./routes/units');
const ticketRoutes = require('./routes/tickets');
const technicianRoutes = require('./routes/technicians');
const categoryRoutes = require('./routes/categories');
const settingRoutes = require('./routes/settings');
const notificationRoutes = require('./routes/notifications');
const auditRoutes = require('./routes/audit');
const adminRoutes = require('./routes/admin');
const managerRoutes = require('./routes/managers');
const tenantRoutes = require('./routes/tenants');
const providerRoutes = require('./routes/providers');
const backupRoutes = require('./routes/backup');
const reportRoutes = require('./routes/reports');
const analyticsRoutes = require('./routes/analytics');

const app = express();

const corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000').split(',').map(s => s.trim());
app.use(cors({ origin: corsOrigins, credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms`);
    }
  });
  next();
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/units', unitRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/technicians', technicianRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/manager', managerRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/providers', providerRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/analytics', analyticsRoutes);

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;

async function start() {
  await initializeDatabase();
  await seed();
  app.listen(PORT, () => {
    console.log(`SPMT API running on port ${PORT}`);
  });
}

start();
