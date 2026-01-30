import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cron from 'node-cron';
import { initDatabase } from './config/database.js';
import analyticsRouter from './routes/analytics.js';
import { dailySnapshotService } from './services/analytics/DailySnapshot.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://seculetter-hubspot-dashboard.onrender.com'
  ],
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/analytics', analyticsRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Info
app.get('/api', (req, res) => {
  res.json({
    name: 'Seculetter HubSpot Dashboard API',
    version: '1.0.0',
    hubspotAccountId: '243367573',
    endpoints: [
      'GET /api/analytics/overview',
      'GET /api/analytics/trends',
      'GET /api/analytics/pipeline',
      'GET /api/analytics/stalled-deals',
      'GET /api/analytics/today-tasks',
      'GET /api/analytics/team-performance',
      'GET /api/analytics/forecast',
      'GET /api/analytics/poc-status',
      'GET /api/analytics/contacts',
      'GET /api/analytics/companies',
      'GET /api/analytics/tickets',
      'GET /api/analytics/activities'
    ]
  });
});

// Manual sync endpoint
app.post('/api/sync', async (req, res) => {
  try {
    const snapshot = await dailySnapshotService.generateSnapshot();
    await dailySnapshotService.saveSnapshot(new Date(), snapshot);
    res.json({ success: true, message: 'Sync completed', snapshot });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ error: 'Sync failed' });
  }
});

// Initialize and start server
async function start() {
  try {
    // Initialize database
    if (process.env.DATABASE_URL) {
      await initDatabase();
      console.log('Database connected');
    } else {
      console.log('Running without database (demo mode)');
    }

    // Schedule daily snapshot at midnight
    cron.schedule('0 0 * * *', async () => {
      console.log('Running daily snapshot...');
      try {
        const snapshot = await dailySnapshotService.generateSnapshot();
        if (process.env.DATABASE_URL) {
          await dailySnapshotService.saveSnapshot(new Date(), snapshot);
        }
        console.log('Daily snapshot completed');
      } catch (error) {
        console.error('Daily snapshot failed:', error);
      }
    });

    app.listen(PORT, () => {
      console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🚀 Seculetter HubSpot Dashboard Backend                ║
║                                                           ║
║   Server running on port ${PORT}                            ║
║   HubSpot Account: 243367573                              ║
║                                                           ║
║   API Endpoints:                                          ║
║   - GET  /api/analytics/overview                          ║
║   - GET  /api/analytics/trends                            ║
║   - GET  /api/analytics/pipeline                          ║
║   - GET  /api/analytics/forecast                          ║
║   - GET  /api/analytics/poc-status                        ║
║   - POST /api/sync                                        ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
