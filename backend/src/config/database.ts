import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export async function initDatabase(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      -- 설정 및 메타데이터 테이블
      CREATE TABLE IF NOT EXISTS hubspot_config (
        id SERIAL PRIMARY KEY,
        account_id VARCHAR(20) NOT NULL DEFAULT '243367573',
        access_token TEXT,
        last_sync_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- 일별 스냅샷: 연락처
      CREATE TABLE IF NOT EXISTS daily_contacts_snapshot (
        id SERIAL PRIMARY KEY,
        snapshot_date DATE NOT NULL,
        total_count INTEGER DEFAULT 0,
        created_count INTEGER DEFAULT 0,
        modified_count INTEGER DEFAULT 0,
        deleted_count INTEGER DEFAULT 0,
        by_source JSONB DEFAULT '{}',
        by_lifecycle_stage JSONB DEFAULT '{}',
        by_decision_maker_role JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(snapshot_date)
      );

      -- 일별 스냅샷: 회사
      CREATE TABLE IF NOT EXISTS daily_companies_snapshot (
        id SERIAL PRIMARY KEY,
        snapshot_date DATE NOT NULL,
        total_count INTEGER DEFAULT 0,
        created_count INTEGER DEFAULT 0,
        modified_count INTEGER DEFAULT 0,
        deleted_count INTEGER DEFAULT 0,
        by_industry JSONB DEFAULT '{}',
        by_size JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(snapshot_date)
      );

      -- 일별 스냅샷: 거래
      CREATE TABLE IF NOT EXISTS daily_deals_snapshot (
        id SERIAL PRIMARY KEY,
        snapshot_date DATE NOT NULL,
        total_active_count INTEGER DEFAULT 0,
        total_pipeline_value DECIMAL(15, 2) DEFAULT 0,
        created_count INTEGER DEFAULT 0,
        won_count INTEGER DEFAULT 0,
        won_value DECIMAL(15, 2) DEFAULT 0,
        lost_count INTEGER DEFAULT 0,
        lost_value DECIMAL(15, 2) DEFAULT 0,
        stage_changes_count INTEGER DEFAULT 0,
        by_stage JSONB DEFAULT '{}',
        by_owner JSONB DEFAULT '{}',
        win_rate DECIMAL(5, 2),
        avg_deal_value DECIMAL(15, 2),
        stalled_deals_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(snapshot_date)
      );

      -- 일별 스냅샷: POC/BMT (보안 솔루션 특화)
      CREATE TABLE IF NOT EXISTS daily_poc_snapshot (
        id SERIAL PRIMARY KEY,
        snapshot_date DATE NOT NULL,
        active_poc_count INTEGER DEFAULT 0,
        started_count INTEGER DEFAULT 0,
        completed_count INTEGER DEFAULT 0,
        success_count INTEGER DEFAULT 0,
        failed_count INTEGER DEFAULT 0,
        avg_poc_duration_days DECIMAL(5, 2),
        success_rate DECIMAL(5, 2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(snapshot_date)
      );

      -- 일별 스냅샷: 티켓
      CREATE TABLE IF NOT EXISTS daily_tickets_snapshot (
        id SERIAL PRIMARY KEY,
        snapshot_date DATE NOT NULL,
        total_open_count INTEGER DEFAULT 0,
        created_count INTEGER DEFAULT 0,
        resolved_count INTEGER DEFAULT 0,
        in_progress_count INTEGER DEFAULT 0,
        by_status JSONB DEFAULT '{}',
        by_priority JSONB DEFAULT '{}',
        avg_resolution_time_hours DECIMAL(10, 2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(snapshot_date)
      );

      -- 일별 스냅샷: 활동
      CREATE TABLE IF NOT EXISTS daily_activities_snapshot (
        id SERIAL PRIMARY KEY,
        snapshot_date DATE NOT NULL,
        meetings_count INTEGER DEFAULT 0,
        calls_count INTEGER DEFAULT 0,
        notes_count INTEGER DEFAULT 0,
        emails_count INTEGER DEFAULT 0,
        tasks_count INTEGER DEFAULT 0,
        total_activities INTEGER DEFAULT 0,
        by_owner JSONB DEFAULT '{}',
        meetings_duration_minutes INTEGER DEFAULT 0,
        calls_duration_minutes INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(snapshot_date)
      );

      -- 거래 단계 변경 이력
      CREATE TABLE IF NOT EXISTS deal_stage_changes (
        id SERIAL PRIMARY KEY,
        deal_id VARCHAR(50) NOT NULL,
        deal_name VARCHAR(255),
        deal_amount DECIMAL(15, 2),
        owner_id VARCHAR(50),
        previous_stage VARCHAR(100),
        new_stage VARCHAR(100),
        changed_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- 정체 거래 (30일 이상)
      CREATE TABLE IF NOT EXISTS stalled_deals (
        id SERIAL PRIMARY KEY,
        deal_id VARCHAR(50) NOT NULL UNIQUE,
        deal_name VARCHAR(255),
        deal_amount DECIMAL(15, 2),
        current_stage VARCHAR(100),
        owner_id VARCHAR(50),
        owner_name VARCHAR(255),
        days_stalled INTEGER,
        last_activity_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- 오늘의 할 일
      CREATE TABLE IF NOT EXISTS today_tasks (
        id SERIAL PRIMARY KEY,
        task_type VARCHAR(50) NOT NULL,
        title VARCHAR(500),
        description TEXT,
        related_deal_id VARCHAR(50),
        related_contact_id VARCHAR(50),
        owner_id VARCHAR(50),
        owner_name VARCHAR(255),
        due_date DATE,
        priority VARCHAR(20),
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- 담당자/사용자 캐시
      CREATE TABLE IF NOT EXISTS owners_cache (
        id SERIAL PRIMARY KEY,
        hubspot_owner_id VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(255),
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        full_name VARCHAR(255),
        team VARCHAR(100),
        is_active BOOLEAN DEFAULT true,
        last_synced_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- 파이프라인 단계 캐시 (보안 솔루션 커스텀)
      CREATE TABLE IF NOT EXISTS pipeline_stages_cache (
        id SERIAL PRIMARY KEY,
        pipeline_id VARCHAR(50) NOT NULL,
        pipeline_name VARCHAR(255),
        stage_id VARCHAR(50) NOT NULL,
        stage_name VARCHAR(255),
        stage_label VARCHAR(255),
        stage_order INTEGER,
        probability DECIMAL(5, 2),
        is_closed BOOLEAN DEFAULT false,
        is_won BOOLEAN DEFAULT false,
        last_synced_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(pipeline_id, stage_id)
      );

      -- 동기화 작업 로그
      CREATE TABLE IF NOT EXISTS sync_jobs (
        id SERIAL PRIMARY KEY,
        job_type VARCHAR(50) NOT NULL,
        object_type VARCHAR(50),
        status VARCHAR(20) NOT NULL,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        records_processed INTEGER DEFAULT 0,
        error_message TEXT,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- 영업 예측 데이터
      CREATE TABLE IF NOT EXISTS sales_forecast (
        id SERIAL PRIMARY KEY,
        forecast_date DATE NOT NULL,
        period_type VARCHAR(20) NOT NULL,
        period_value VARCHAR(20) NOT NULL,
        expected_revenue DECIMAL(15, 2) DEFAULT 0,
        weighted_revenue DECIMAL(15, 2) DEFAULT 0,
        best_case_revenue DECIMAL(15, 2) DEFAULT 0,
        worst_case_revenue DECIMAL(15, 2) DEFAULT 0,
        deals_count INTEGER DEFAULT 0,
        by_stage JSONB DEFAULT '{}',
        by_owner JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(forecast_date, period_type, period_value)
      );

      -- 인덱스 생성
      CREATE INDEX IF NOT EXISTS idx_deal_stage_changes_date ON deal_stage_changes(changed_at);
      CREATE INDEX IF NOT EXISTS idx_deal_stage_changes_deal ON deal_stage_changes(deal_id);
      CREATE INDEX IF NOT EXISTS idx_sync_jobs_status ON sync_jobs(status);
      CREATE INDEX IF NOT EXISTS idx_stalled_deals_days ON stalled_deals(days_stalled);
    `);
    console.log('Database initialized successfully');
  } finally {
    client.release();
  }
}
