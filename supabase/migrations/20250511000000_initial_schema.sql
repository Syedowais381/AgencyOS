-- Agency Operating System — Phase 1 schema + RLS
-- Roles for agency membership (not JWT claims — stored in Postgres per Supabase security guidance)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE public.agency_member_role AS ENUM ('owner', 'admin', 'member');
CREATE TYPE public.client_portal_role AS ENUM ('viewer', 'admin');
CREATE TYPE public.lead_stage AS ENUM (
  'new',
  'contacted',
  'qualified',
  'appointment_set',
  'showed',
  'won',
  'lost'
);

-- ---------------------------------------------------------------------------
-- Core identity
-- ---------------------------------------------------------------------------

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  is_super_admin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.agencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  owner_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.agency_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  role public.agency_member_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (agency_id, user_id)
);

CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (agency_id, slug)
);

CREATE TABLE public.client_portal_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  role public.client_portal_role NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (client_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Onboarding & brand (foundation for later AI modules)
-- ---------------------------------------------------------------------------

CREATE TABLE public.onboarding_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  schema JSONB NOT NULL DEFAULT '{}'::JSONB,
  responses JSONB NOT NULL DEFAULT '{}'::JSONB,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.brand_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  voice_notes TEXT,
  assets JSONB NOT NULL DEFAULT '[]'::JSONB,
  niche TEXT,
  offer_summary TEXT,
  audience_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (client_id)
);

-- ---------------------------------------------------------------------------
-- CRM visualization layer
-- ---------------------------------------------------------------------------

CREATE TABLE public.pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients (id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  external_source TEXT,
  external_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID NOT NULL REFERENCES public.pipelines (id) ON DELETE CASCADE,
  stage public.lead_stage NOT NULL DEFAULT 'new',
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  value_cents BIGINT NOT NULL DEFAULT 0,
  score INTEGER NOT NULL DEFAULT 0,
  attribution JSONB NOT NULL DEFAULT '{}'::JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  last_activity_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Content, tasks, sales, AI stubs (columns expanded in later phases)
-- ---------------------------------------------------------------------------

CREATE TABLE public.content_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients (id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  stage TEXT NOT NULL DEFAULT 'idea',
  platform TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.content_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  metric_date DATE NOT NULL,
  followers BIGINT NOT NULL DEFAULT 0,
  reach BIGINT NOT NULL DEFAULT 0,
  engagement BIGINT NOT NULL DEFAULT 0,
  views BIGINT NOT NULL DEFAULT 0,
  watch_time_seconds BIGINT NOT NULL DEFAULT 0,
  ctr NUMERIC(8, 4),
  payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (client_id, platform, metric_date)
);

CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,
  assignee_id UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  due_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.sales_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,
  closer_id UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads (id) ON DELETE SET NULL,
  outcome TEXT,
  revenue_cents BIGINT NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  recording_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.call_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_call_id UUID NOT NULL REFERENCES public.sales_calls (id) ON DELETE CASCADE,
  summary TEXT,
  objections JSONB NOT NULL DEFAULT '[]'::JSONB,
  sentiment JSONB NOT NULL DEFAULT '{}'::JSONB,
  coaching_notes TEXT,
  scores JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.ai_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients (id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  model TEXT,
  content JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients (id) ON DELETE SET NULL,
  period TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  type TEXT NOT NULL DEFAULT 'info',
  read_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'disconnected',
  config JSONB NOT NULL DEFAULT '{}'::JSONB,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (agency_id, provider)
);

CREATE TABLE public.automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  external_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  last_run_at TIMESTAMPTZ,
  error_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.competitor_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients (id) ON DELETE SET NULL,
  platform TEXT NOT NULL,
  handle TEXT NOT NULL,
  snapshot JSONB NOT NULL DEFAULT '{}'::JSONB,
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.team_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  tasks_completed INTEGER NOT NULL DEFAULT 0,
  dms_sent INTEGER NOT NULL DEFAULT 0,
  calls_logged INTEGER NOT NULL DEFAULT 0,
  revenue_cents BIGINT NOT NULL DEFAULT 0,
  payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (agency_id, user_id, metric_date)
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX idx_agency_members_user ON public.agency_members (user_id);
CREATE INDEX idx_agency_members_agency ON public.agency_members (agency_id);
CREATE INDEX idx_clients_agency ON public.clients (agency_id);
CREATE INDEX idx_leads_pipeline ON public.leads (pipeline_id);
CREATE INDEX idx_leads_stage ON public.leads (stage);
CREATE INDEX idx_pipelines_agency ON public.pipelines (agency_id);
CREATE INDEX idx_notifications_user ON public.notifications (user_id);

-- ---------------------------------------------------------------------------
-- Triggers: profile on signup, owner membership on new agency
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_agency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.agency_members (agency_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_agency_created
  AFTER INSERT ON public.agencies
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_agency();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_portal_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitor_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_metrics ENABLE ROW LEVEL SECURITY;

-- Profiles: self + super admins see all (for global admin UI)
CREATE POLICY "profiles_select"
  ON public.profiles FOR SELECT
  USING (
    id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.is_super_admin
    )
  );

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

-- Agencies
CREATE POLICY "agencies_select"
  ON public.agencies FOR SELECT
  USING (
    owner_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.agency_members m
      WHERE m.agency_id = agencies.id AND m.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.is_super_admin
    )
  );

CREATE POLICY "agencies_insert_owner"
  ON public.agencies FOR INSERT
  WITH CHECK (owner_id = (SELECT auth.uid()));

CREATE POLICY "agencies_update_owner_admin"
  ON public.agencies FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.agency_members m
      WHERE m.agency_id = agencies.id
        AND m.user_id = (SELECT auth.uid())
        AND m.role IN ('owner', 'admin')
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.is_super_admin
    )
  );

-- Agency members
CREATE POLICY "agency_members_select"
  ON public.agency_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.agency_members m
      WHERE m.agency_id = agency_members.agency_id AND m.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.is_super_admin
    )
  );

CREATE POLICY "agency_members_insert_by_owner_admin"
  ON public.agency_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agency_members m
      WHERE m.agency_id = agency_members.agency_id
        AND m.user_id = (SELECT auth.uid())
        AND m.role IN ('owner', 'admin')
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.is_super_admin
    )
  );

CREATE POLICY "agency_members_delete_by_owner_admin"
  ON public.agency_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.agency_members m
      WHERE m.agency_id = agency_members.agency_id
        AND m.user_id = (SELECT auth.uid())
        AND m.role IN ('owner', 'admin')
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.is_super_admin
    )
  );

-- Clients: agency members or portal users
CREATE POLICY "clients_select"
  ON public.clients FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.agency_members m
      WHERE m.agency_id = clients.agency_id AND m.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.client_portal_access ca
      WHERE ca.client_id = clients.id AND ca.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.is_super_admin
    )
  );

CREATE POLICY "clients_mutate_agency_staff"
  ON public.clients FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.agency_members m
      WHERE m.agency_id = clients.agency_id AND m.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.is_super_admin
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agency_members m
      WHERE m.agency_id = clients.agency_id AND m.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.is_super_admin
    )
  );

-- Client portal access management
CREATE POLICY "client_portal_access_select"
  ON public.client_portal_access FOR SELECT
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.clients c
      JOIN public.agency_members m ON m.agency_id = c.agency_id
      WHERE c.id = client_portal_access.client_id AND m.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.is_super_admin
    )
  );

CREATE POLICY "client_portal_access_mutate_staff"
  ON public.client_portal_access FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      JOIN public.agency_members m ON m.agency_id = c.agency_id
      WHERE c.id = client_portal_access.client_id
        AND m.user_id = (SELECT auth.uid())
        AND m.role IN ('owner', 'admin')
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.is_super_admin
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clients c
      JOIN public.agency_members m ON m.agency_id = c.agency_id
      WHERE c.id = client_portal_access.client_id
        AND m.user_id = (SELECT auth.uid())
        AND m.role IN ('owner', 'admin')
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.is_super_admin
    )
  );

-- Generic agency-scoped helper pattern for remaining tables
CREATE POLICY "onboarding_forms_agency"
  ON public.onboarding_forms FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.agency_members m
      WHERE m.agency_id = onboarding_forms.agency_id AND m.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.is_super_admin
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agency_members m
      WHERE m.agency_id = onboarding_forms.agency_id AND m.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.is_super_admin
    )
  );

CREATE POLICY "brand_profiles_client_access"
  ON public.brand_profiles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      JOIN public.agency_members m ON m.agency_id = c.agency_id
      WHERE c.id = brand_profiles.client_id AND m.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.client_portal_access ca
      WHERE ca.client_id = brand_profiles.client_id AND ca.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.is_super_admin
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clients c
      JOIN public.agency_members m ON m.agency_id = c.agency_id
      WHERE c.id = brand_profiles.client_id AND m.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.is_super_admin
    )
  );

CREATE POLICY "pipelines_agency"
  ON public.pipelines FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.agency_members m
      WHERE m.agency_id = pipelines.agency_id AND m.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.is_super_admin
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agency_members m
      WHERE m.agency_id = pipelines.agency_id AND m.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.is_super_admin
    )
  );

CREATE POLICY "leads_via_pipeline"
  ON public.leads FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.pipelines pl
      JOIN public.agency_members m ON m.agency_id = pl.agency_id
      WHERE pl.id = leads.pipeline_id AND m.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.is_super_admin
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pipelines pl
      JOIN public.agency_members m ON m.agency_id = pl.agency_id
      WHERE pl.id = leads.pipeline_id AND m.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.is_super_admin
    )
  );

CREATE POLICY "content_items_agency"
  ON public.content_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.agency_members m
      WHERE m.agency_id = content_items.agency_id AND m.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.is_super_admin
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agency_members m
      WHERE m.agency_id = content_items.agency_id AND m.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.is_super_admin
    )
  );

CREATE POLICY "content_analytics_client"
  ON public.content_analytics FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      JOIN public.agency_members m ON m.agency_id = c.agency_id
      WHERE c.id = content_analytics.client_id AND m.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.client_portal_access ca
      WHERE ca.client_id = content_analytics.client_id AND ca.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.is_super_admin
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clients c
      JOIN public.agency_members m ON m.agency_id = c.agency_id
      WHERE c.id = content_analytics.client_id AND m.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.is_super_admin
    )
  );

CREATE POLICY "tasks_agency"
  ON public.tasks FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.agency_members m
      WHERE m.agency_id = tasks.agency_id AND m.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.is_super_admin
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agency_members m
      WHERE m.agency_id = tasks.agency_id AND m.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.is_super_admin
    )
  );

CREATE POLICY "sales_calls_agency"
  ON public.sales_calls FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.agency_members m
      WHERE m.agency_id = sales_calls.agency_id AND m.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.is_super_admin
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agency_members m
      WHERE m.agency_id = sales_calls.agency_id AND m.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.is_super_admin
    )
  );

CREATE POLICY "call_analysis_via_call"
  ON public.call_analysis FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.sales_calls sc
      JOIN public.agency_members m ON m.agency_id = sc.agency_id
      WHERE sc.id = call_analysis.sales_call_id AND m.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.is_super_admin
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sales_calls sc
      JOIN public.agency_members m ON m.agency_id = sc.agency_id
      WHERE sc.id = call_analysis.sales_call_id AND m.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.is_super_admin
    )
  );

CREATE POLICY "ai_outputs_agency"
  ON public.ai_outputs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.agency_members m
      WHERE m.agency_id = ai_outputs.agency_id AND m.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.is_super_admin
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agency_members m
      WHERE m.agency_id = ai_outputs.agency_id AND m.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.is_super_admin
    )
  );

CREATE POLICY "reports_agency"
  ON public.reports FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.agency_members m
      WHERE m.agency_id = reports.agency_id AND m.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.is_super_admin
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agency_members m
      WHERE m.agency_id = reports.agency_id AND m.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.is_super_admin
    )
  );

CREATE POLICY "notifications_own"
  ON public.notifications FOR ALL
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "integrations_agency"
  ON public.integrations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.agency_members m
      WHERE m.agency_id = integrations.agency_id AND m.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.is_super_admin
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agency_members m
      WHERE m.agency_id = integrations.agency_id AND m.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.is_super_admin
    )
  );

CREATE POLICY "automations_agency"
  ON public.automations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.agency_members m
      WHERE m.agency_id = automations.agency_id AND m.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.is_super_admin
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agency_members m
      WHERE m.agency_id = automations.agency_id AND m.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.is_super_admin
    )
  );

CREATE POLICY "competitor_data_agency"
  ON public.competitor_data FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.agency_members m
      WHERE m.agency_id = competitor_data.agency_id AND m.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.is_super_admin
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agency_members m
      WHERE m.agency_id = competitor_data.agency_id AND m.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.is_super_admin
    )
  );

CREATE POLICY "team_metrics_agency"
  ON public.team_metrics FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.agency_members m
      WHERE m.agency_id = team_metrics.agency_id AND m.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.is_super_admin
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agency_members m
      WHERE m.agency_id = team_metrics.agency_id AND m.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.is_super_admin
    )
  );
