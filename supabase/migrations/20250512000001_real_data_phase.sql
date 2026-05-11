-- Real data phase: active agency, CRM extensions, GHL integration, webhooks, activity, health

-- ---------------------------------------------------------------------------
-- 1) User preferences (active agency)
-- ---------------------------------------------------------------------------

CREATE TABLE public.user_preferences (
  user_id UUID PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  active_agency_id UUID REFERENCES public.agencies (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_preferences_active_agency ON public.user_preferences (active_agency_id);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_preferences_select_own"
  ON public.user_preferences FOR SELECT
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "user_preferences_insert_own"
  ON public.user_preferences FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "user_preferences_update_own"
  ON public.user_preferences FOR UPDATE
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE OR REPLACE FUNCTION public.touch_user_preferences_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_user_preferences_updated
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE PROCEDURE public.touch_user_preferences_updated_at();

-- Default active agency when user joins an agency
CREATE OR REPLACE FUNCTION public.ensure_default_active_agency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_preferences (user_id, active_agency_id)
  VALUES (NEW.user_id, NEW.agency_id)
  ON CONFLICT (user_id) DO UPDATE
  SET active_agency_id = COALESCE(public.user_preferences.active_agency_id, EXCLUDED.active_agency_id),
      updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_agency_member_default_active
  AFTER INSERT ON public.agency_members
  FOR EACH ROW EXECUTE PROCEDURE public.ensure_default_active_agency();

-- Backfill preferences for existing members
INSERT INTO public.user_preferences (user_id, active_agency_id)
SELECT DISTINCT ON (m.user_id) m.user_id, m.agency_id
FROM public.agency_members m
LEFT JOIN public.user_preferences up ON up.user_id = m.user_id
WHERE up.user_id IS NULL
ORDER BY m.user_id, m.created_at ASC;

-- ---------------------------------------------------------------------------
-- 2) Leads / pipelines: external ids + incremental cursor
-- ---------------------------------------------------------------------------

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS external_updated_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS leads_pipeline_external_uid
  ON public.leads (pipeline_id, external_id)
  WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_external_updated ON public.leads (external_updated_at);

ALTER TABLE public.pipelines
  ADD COLUMN IF NOT EXISTS external_updated_at TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- 3) CRM stage mapping (GHL pipelineStageId -> internal lead_stage)
-- ---------------------------------------------------------------------------

CREATE TABLE public.crm_stage_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,
  external_pipeline_id TEXT,
  external_stage_id TEXT NOT NULL,
  internal_stage public.lead_stage NOT NULL,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (agency_id, external_pipeline_id, external_stage_id)
);

CREATE INDEX idx_crm_stage_map_agency ON public.crm_stage_map (agency_id);

ALTER TABLE public.crm_stage_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_stage_map_agency"
  ON public.crm_stage_map FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.agency_members m
      WHERE m.agency_id = crm_stage_map.agency_id AND m.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.is_super_admin
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agency_members m
      WHERE m.agency_id = crm_stage_map.agency_id AND m.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.is_super_admin
    )
  );

-- ---------------------------------------------------------------------------
-- 4) Encrypted credentials (RLS: no policies for authenticated — service role only)
-- ---------------------------------------------------------------------------

CREATE TABLE public.integration_credentials (
  integration_id UUID PRIMARY KEY REFERENCES public.integrations (id) ON DELETE CASCADE,
  ciphertext TEXT NOT NULL,
  iv TEXT NOT NULL,
  auth_tag TEXT NOT NULL,
  key_version SMALLINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.integration_credentials ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 5) Sync runs (visible to agency staff)
-- ---------------------------------------------------------------------------

CREATE TABLE public.integration_sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES public.integrations (id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,
  mode TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  stats JSONB NOT NULL DEFAULT '{}'::JSONB,
  error TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE INDEX idx_integration_sync_runs_integration ON public.integration_sync_runs (integration_id, started_at DESC);
CREATE INDEX idx_integration_sync_runs_agency ON public.integration_sync_runs (agency_id, started_at DESC);

ALTER TABLE public.integration_sync_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "integration_sync_runs_select_agency"
  ON public.integration_sync_runs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.agency_members m
      WHERE m.agency_id = integration_sync_runs.agency_id AND m.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.is_super_admin
    )
  );

-- Inserts performed with user JWT in app; restrict to agency members
CREATE POLICY "integration_sync_runs_insert_agency"
  ON public.integration_sync_runs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agency_members m
      WHERE m.agency_id = integration_sync_runs.agency_id AND m.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.is_super_admin
    )
  );

CREATE POLICY "integration_sync_runs_update_agency"
  ON public.integration_sync_runs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.agency_members m
      WHERE m.agency_id = integration_sync_runs.agency_id AND m.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.is_super_admin
    )
  );

-- ---------------------------------------------------------------------------
-- 6) Webhook inbox (service role only — no authenticated policies)
-- ---------------------------------------------------------------------------

CREATE TABLE public.webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  integration_id UUID REFERENCES public.integrations (id) ON DELETE SET NULL,
  agency_id UUID REFERENCES public.agencies (id) ON DELETE SET NULL,
  payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  status TEXT NOT NULL DEFAULT 'received',
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  UNIQUE (provider, event_id)
);

CREATE INDEX idx_webhook_events_agency ON public.webhook_events (agency_id, created_at DESC);

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 7) Activity feed (agency scoped)
-- ---------------------------------------------------------------------------

CREATE TABLE public.activity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  entity_type TEXT,
  entity_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activity_events_agency_created ON public.activity_events (agency_id, created_at DESC);
CREATE INDEX idx_activity_events_type ON public.activity_events (agency_id, type);

ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity_events_select_agency"
  ON public.activity_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.agency_members m
      WHERE m.agency_id = activity_events.agency_id AND m.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.is_super_admin
    )
  );

CREATE POLICY "activity_events_insert_agency"
  ON public.activity_events FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agency_members m
      WHERE m.agency_id = activity_events.agency_id AND m.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.is_super_admin
    )
  );

-- ---------------------------------------------------------------------------
-- 8) Lead notes & activities
-- ---------------------------------------------------------------------------

CREATE TABLE public.lead_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads (id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lead_notes_lead ON public.lead_notes (lead_id, created_at DESC);

ALTER TABLE public.lead_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lead_notes_via_lead"
  ON public.lead_notes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.leads l
      JOIN public.pipelines pl ON pl.id = l.pipeline_id
      JOIN public.agency_members m ON m.agency_id = pl.agency_id
      WHERE l.id = lead_notes.lead_id AND m.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.is_super_admin
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.leads l
      JOIN public.pipelines pl ON pl.id = l.pipeline_id
      JOIN public.agency_members m ON m.agency_id = pl.agency_id
      WHERE l.id = lead_notes.lead_id AND m.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.is_super_admin
    )
  );

CREATE TABLE public.lead_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads (id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'system',
  kind TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lead_activities_lead ON public.lead_activities (lead_id, created_at DESC);

ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lead_activities_via_lead"
  ON public.lead_activities FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.leads l
      JOIN public.pipelines pl ON pl.id = l.pipeline_id
      JOIN public.agency_members m ON m.agency_id = pl.agency_id
      WHERE l.id = lead_activities.lead_id AND m.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.is_super_admin
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.leads l
      JOIN public.pipelines pl ON pl.id = l.pipeline_id
      JOIN public.agency_members m ON m.agency_id = pl.agency_id
      WHERE l.id = lead_activities.lead_id AND m.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.is_super_admin
    )
  );

-- ---------------------------------------------------------------------------
-- 9) Integration health columns
-- ---------------------------------------------------------------------------

ALTER TABLE public.integrations
  ADD COLUMN IF NOT EXISTS health_status TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS external_location_id TEXT;

CREATE INDEX IF NOT EXISTS idx_integrations_location ON public.integrations (external_location_id)
  WHERE external_location_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS pipelines_agency_external_uid
  ON public.pipelines (agency_id, external_id)
  WHERE external_id IS NOT NULL;
