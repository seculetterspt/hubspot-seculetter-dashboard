import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDatabase } from './config/database.js';
import analyticsRouter from './routes/analytics.js';

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
      'GET /api/analytics/activity-timeline'
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
    } else {
      console.log('Running without database (demo mode)');
    }

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
║   - GET  /api/analytics/activity-timeline                 ║
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
