import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import cron from 'node-cron';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { initDatabase, pool } from './config/database.js';
import analyticsRouter from './routes/analytics.js';
import snapshotRouter from './routes/snapshot.js';
import meetingsRouter from './routes/meetings.js';
import weeklyMeetingsRouter from './routes/weekly-meetings.js';
import weeklyReportsRouter from './routes/weekly-reports.js';
import authRouter from './routes/auth.js';
// 세션(구): /reports 정적 페이지 보호용으로만 잔존
import { validateSession, requirePageAuth } from './middleware/auth.js';
// Supabase JWT(신): /api/* 는 통합 콘솔(support 셸)의 Bearer 토큰으로 인증
import { isAuthenticated, requireStaffOrAdmin } from './middleware/auth-supabase.js';
import cors from 'cors';
import { snapshotService } from './services/snapshot/SnapshotService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Session store setup
const PostgresqlStore = connectPgSimple(session);
const sessionStore = new PostgresqlStore({
  pool: pool,
  tableName: 'session',
});

// IMPORTANT: Register middleware and routes in correct order
// 0. CORS — 통합 콘솔(support 셸)이 다른 출처에서 Bearer 토큰으로 호출하므로 Authorization 허용 필수.
//    허용 출처는 CORS_ORIGINS(콤마구분)로 오버라이드. 쿠키 안 씀(JWT 헤더).
app.use(cors({
  origin: (process.env.CORS_ORIGINS ||
    'https://frontend-gamma-two-90.vercel.app,http://localhost:5173')
    .split(',').map((o) => o.trim()).filter(Boolean),
  allowedHeaders: ['Content-Type', 'Authorization'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: false,
}));

// 1. Body parsing (must come before routes)
app.use(express.json({ limit: '25mb' }));

// 2. Session middleware
app.use(session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
}));

// 3. Validate session
app.use(validateSession);

// 4. Auth routes (MUST come before static files to take precedence)
app.use('/auth', authRouter);

// 5. Protected API routes — Supabase JWT 검증 + staff/admin 권한
app.use('/api/analytics', isAuthenticated, requireStaffOrAdmin, analyticsRouter);
app.use('/api/snapshot', isAuthenticated, requireStaffOrAdmin, snapshotRouter);
app.use('/api/meetings', isAuthenticated, requireStaffOrAdmin, meetingsRouter);
app.use('/api/weekly-meetings', isAuthenticated, requireStaffOrAdmin, weeklyMeetingsRouter);
app.use('/api/weekly-reports', isAuthenticated, requireStaffOrAdmin, weeklyReportsRouter);

// 5b. Protected report pages (SLCDR 조달등록 계획 / 가격표)
// Gated behind HubSpot login session — sensitive tax invoices & pricing.
// Must be registered BEFORE the public SPA static + SPA fallback so it takes precedence.
const reportsPath = path.join(process.cwd(), 'reports');
app.use('/reports', requirePageAuth, express.static(reportsPath, {
  extensions: ['html'],  // /reports/slcdr -> slcdr/index.html
}));
console.log('[Server] Serving protected reports from:', reportsPath);

// 6. Static files (comes after auth routes)
const publicPath = path.join(process.cwd(), 'public');
app.use(express.static(publicPath, {
  index: false  // Don't serve index.html automatically
}));
console.log('[Server] Serving static files from:', publicPath);

// 7. Disable caching for HTML, JS, CSS files
app.use((req, res, next) => {
  if (req.path.endsWith('.html') || req.path.endsWith('.js') || req.path.endsWith('.css') || req.path === '/') {
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
  }
  next();
});

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
      'GET /api/snapshot/history',
      'GET /api/meetings/owners',
      'GET /api/meetings/scheduled',
      'POST /api/meetings/transcribe',
      'POST /api/meetings/structure',
      'POST /api/meetings/recommend',
      'POST /api/meetings/save',
      'GET /api/meetings/records',
      'DELETE /api/meetings/records/:id',
      'GET /api/meetings/search',
      'GET /api/weekly-meetings',
      'GET /api/weekly-meetings/:date',
      'POST /api/weekly-meetings',
      'POST /api/weekly-meetings/parse',
      'DELETE /api/weekly-meetings/:id',
      'GET /api/weekly-meetings/search/deals'
    ]
  });
});

// SPA fallback: serve index.html for non-API/non-auth routes
app.get('*', (req, res) => {
  // Don't serve SPA for API, auth, or health check routes
  if (req.path.startsWith('/api') || req.path.startsWith('/auth') || req.path === '/health') {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(publicPath, 'index.html'));
});

// Initialize and start server
async function start() {
  try {
    // Initialize database
    if (process.env.DATABASE_URL) {
      await initDatabase();
      console.log('Database connected');

      // 서버 시작 시 첫 스냅샷 생성 (이번 주 기준)
      console.log('[Startup] Creating initial snapshot...');
      try {
        await snapshotService.saveSnapshot();
        console.log('[Startup] Initial snapshot created successfully');
      } catch (error) {
        console.error('[Startup] Initial snapshot failed:', error);
      }

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
