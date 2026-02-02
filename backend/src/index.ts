import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cron from 'node-cron';
import { initDatabase } from './config/database.js';
import analyticsRouter from './routes/analytics.js';
import snapshotRouter from './routes/snapshot.js';
import { snapshotService } from './services/snapshot/SnapshotService.js';

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
app.use('/api/snapshot', snapshotRouter);

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
      'GET /api/analytics/activity-timeline',
      'GET /api/analytics/deal-summary',
      'POST /api/snapshot/create',
      'GET /api/snapshot/comparison',
      'GET /api/snapshot/history'
    ]
  });
});

// Initialize and start server
async function start() {
  try {
    // Initialize database
    if (process.env.DATABASE_URL) {
      await initDatabase();
      console.log('Database connected');

      // 매주 월요일 오전 7시에 스냅샷 생성 (한국 시간 기준)
      // cron format: 분 시 일 월 요일
      // 0 7 * * 1 = 매주 월요일 7:00
      cron.schedule('0 7 * * 1', async () => {
        console.log('[Cron] Starting weekly snapshot job...');
        try {
          await snapshotService.saveSnapshot();
          console.log('[Cron] Weekly snapshot completed successfully');
        } catch (error) {
          console.error('[Cron] Weekly snapshot failed:', error);
        }
      }, {
        timezone: 'Asia/Seoul'
      });
      console.log('Weekly snapshot cron job scheduled (Every Monday 7:00 AM KST)');
    } else {
      console.log('Running without database (demo mode)');
    }

    app.listen(PORT, () => {
      console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   Seculetter HubSpot Dashboard Backend                    ║
║                                                           ║
║   Server running on port ${PORT}                            ║
║   HubSpot Account: 243367573                              ║
║                                                           ║
║   API Endpoints:                                          ║
║   - GET  /api/analytics/activity-timeline                 ║
║   - GET  /api/analytics/deal-summary                      ║
║   - GET  /api/snapshot/comparison                         ║
║   - POST /api/snapshot/create                             ║
║                                                           ║
║   Cron: Weekly snapshot (Mon 7:00 AM KST)                 ║
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
