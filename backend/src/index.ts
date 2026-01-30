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

// Manual raw snapshot save (for testing)
app.post('/api/save-snapshot', async (req, res) => {
  try {
    const targetDate = req.body.date ? new Date(req.body.date) : new Date();
    await dailySnapshotService.saveRawSnapshot(targetDate);
    res.json({
      success: true,
      message: `Raw snapshot saved for ${targetDate.toISOString().split('T')[0]}`,
      date: targetDate.toISOString().split('T')[0]
    });
  } catch (error) {
    console.error('Save snapshot error:', error);
    res.status(500).json({ error: 'Save snapshot failed' });
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

    // Schedule daily snapshot at 7 AM KST (22:00 UTC previous day)
    // Cron: minute hour day month weekday
    // 0 22 * * * = 22:00 UTC = 07:00 KST next day
    cron.schedule('0 22 * * *', async () => {
      console.log('Running daily snapshot at 7 AM KST...');
      try {
        const now = new Date();
        // UTC 22:00 = KST 다음날 07:00
        const kstDate = new Date(now.getTime() + (9 * 60 * 60 * 1000)); // UTC + 9시간 = KST

        const snapshot = await dailySnapshotService.generateSnapshot();
        if (process.env.DATABASE_URL) {
          await dailySnapshotService.saveSnapshot(kstDate, snapshot);
          await dailySnapshotService.saveRawSnapshot(kstDate);
        }
        console.log('Daily snapshot completed for', kstDate.toISOString().split('T')[0]);
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
