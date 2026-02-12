-- Enable UUID extension (public schema에 설치)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;
-- Enable pgcrypto extension for gen_random_bytes
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA public;

-- Organizations table
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Users table (extends Supabase auth.users)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'recruiter' CHECK (role IN ('admin', 'recruiter', 'interviewer')),
  calendar_provider TEXT CHECK (calendar_provider IN ('google', 'outlook')),
  calendar_access_token TEXT,
  calendar_refresh_token TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Processes table
CREATE TABLE processes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  stages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Job posts table
CREATE TABLE job_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  process_id UUID NOT NULL REFERENCES processes(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Candidates table
CREATE TABLE candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_post_id UUID NOT NULL REFERENCES job_posts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'confirmed', 'rejected', 'issue')),
  current_stage_id TEXT,
  token TEXT NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Schedules table
CREATE TABLE schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  stage_id TEXT NOT NULL,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected', 'completed')),
  interviewer_ids UUID[] NOT NULL DEFAULT '{}',
  candidate_response TEXT CHECK (candidate_response IN ('accepted', 'rejected', 'pending')),
  beverage_preference TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Schedule options table (AI-generated options)
CREATE TABLE schedule_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'selected', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Timeline events table
CREATE TABLE timeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('system_log', 'schedule_created', 'schedule_confirmed', 'stage_changed')),
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_users_organization_id ON users(organization_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_job_posts_organization_id ON job_posts(organization_id);
CREATE INDEX idx_candidates_job_post_id ON candidates(job_post_id);
CREATE INDEX idx_candidates_token ON candidates(token);
CREATE INDEX idx_candidates_status ON candidates(status);
CREATE INDEX idx_schedules_candidate_id ON schedules(candidate_id);
CREATE INDEX idx_schedules_status ON schedules(status);
CREATE INDEX idx_schedule_options_schedule_id ON schedule_options(schedule_id);
CREATE INDEX idx_timeline_events_candidate_id ON timeline_events(candidate_id);
CREATE INDEX idx_timeline_events_created_at ON timeline_events(created_at DESC);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_processes_updated_at BEFORE UPDATE ON processes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_job_posts_updated_at BEFORE UPDATE ON job_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_candidates_updated_at BEFORE UPDATE ON candidates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_schedules_updated_at BEFORE UPDATE ON schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE processes ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE timeline_events ENABLE ROW LEVEL SECURITY;

-- Organizations: Users can only see their own organization
CREATE POLICY "Users can view their own organization"
  ON organizations FOR SELECT
  USING (
    id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

-- Users: Users can view users in their organization
CREATE POLICY "Users can view users in their organization"
  ON users FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

-- Users: Users can update their own profile
CREATE POLICY "Users can update their own profile"
  ON users FOR UPDATE
  USING (id = auth.uid());

-- Processes: Users can view processes in their organization
CREATE POLICY "Users can view processes in their organization"
  ON processes FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

-- Processes: Users can manage processes in their organization
CREATE POLICY "Users can manage processes in their organization"
  ON processes FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

-- Job posts: Users can view job posts in their organization
CREATE POLICY "Users can view job posts in their organization"
  ON job_posts FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

-- Job posts: Users can manage job posts in their organization
CREATE POLICY "Users can manage job posts in their organization"
  ON job_posts FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

-- Candidates: Users can view candidates in their organization
CREATE POLICY "Users can view candidates in their organization"
  ON candidates FOR SELECT
  USING (
    job_post_id IN (
      SELECT id FROM job_posts WHERE organization_id IN (
        SELECT organization_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- Candidates: Users can manage candidates in their organization
CREATE POLICY "Users can manage candidates in their organization"
  ON candidates FOR ALL
  USING (
    job_post_id IN (
      SELECT id FROM job_posts WHERE organization_id IN (
        SELECT organization_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- Schedules: Users can view schedules for candidates in their organization or if they are an interviewer
CREATE POLICY "Users can view relevant schedules"
  ON schedules FOR SELECT
  USING (
    candidate_id IN (
      SELECT id FROM candidates WHERE job_post_id IN (
        SELECT id FROM job_posts WHERE organization_id IN (
          SELECT organization_id FROM users WHERE id = auth.uid()
        )
      )
    )
    OR auth.uid() = ANY(interviewer_ids)
  );

-- Schedules: Users can manage schedules for candidates in their organization
CREATE POLICY "Users can manage schedules in their organization"
  ON schedules FOR ALL
  USING (
    candidate_id IN (
      SELECT id FROM candidates WHERE job_post_id IN (
        SELECT id FROM job_posts WHERE organization_id IN (
          SELECT organization_id FROM users WHERE id = auth.uid()
        )
      )
    )
  );

-- Schedule options: Same as schedules
CREATE POLICY "Users can view schedule options"
  ON schedule_options FOR SELECT
  USING (
    schedule_id IN (
      SELECT id FROM schedules WHERE candidate_id IN (
        SELECT id FROM candidates WHERE job_post_id IN (
          SELECT id FROM job_posts WHERE organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()
          )
        )
      )
    )
  );

CREATE POLICY "Users can manage schedule options"
  ON schedule_options FOR ALL
  USING (
    schedule_id IN (
      SELECT id FROM schedules WHERE candidate_id IN (
        SELECT id FROM candidates WHERE job_post_id IN (
          SELECT id FROM job_posts WHERE organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()
          )
        )
      )
    )
  );

-- Timeline events: Users can view timeline events for candidates in their organization
CREATE POLICY "Users can view timeline events"
  ON timeline_events FOR SELECT
  USING (
    candidate_id IN (
      SELECT id FROM candidates WHERE job_post_id IN (
        SELECT id FROM job_posts WHERE organization_id IN (
          SELECT organization_id FROM users WHERE id = auth.uid()
        )
      )
    )
  );

-- Timeline events: Users can create timeline events for candidates in their organization
CREATE POLICY "Users can create timeline events"
  ON timeline_events FOR INSERT
  WITH CHECK (
    candidate_id IN (
      SELECT id FROM candidates WHERE job_post_id IN (
        SELECT id FROM job_posts WHERE organization_id IN (
          SELECT organization_id FROM users WHERE id = auth.uid()
        )
      )
    )
  );
