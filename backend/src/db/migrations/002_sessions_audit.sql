-- Create session table for express-session + connect-pg-simple
CREATE TABLE IF NOT EXISTS "session" (
  "sid" varchar NOT NULL COLLATE "default",
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL,
  PRIMARY KEY ("sid")
);

-- Index for efficient cleanup of expired sessions
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");

-- Create audit_logs table for write operation tracking
CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" SERIAL PRIMARY KEY,
  "timestamp" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "user_email" VARCHAR(255) NOT NULL,
  "action_type" VARCHAR(50) NOT NULL,
  "target_id" VARCHAR(255),
  "target_type" VARCHAR(50),
  "status" VARCHAR(20) NOT NULL,
  "error_message" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for efficient querying
CREATE INDEX IF NOT EXISTS "IDX_audit_logs_user_email" ON "audit_logs" ("user_email");
CREATE INDEX IF NOT EXISTS "IDX_audit_logs_timestamp" ON "audit_logs" ("timestamp" DESC);
CREATE INDEX IF NOT EXISTS "IDX_audit_logs_action_type" ON "audit_logs" ("action_type");
