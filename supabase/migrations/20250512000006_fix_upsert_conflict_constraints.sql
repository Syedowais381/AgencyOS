-- Fix ON CONFLICT failures during CRM sync.
-- Postgres cannot use partial unique indexes for ON CONFLICT(column_list)
-- inference in this upsert pattern, so create full unique indexes.

DROP INDEX IF EXISTS public.leads_pipeline_external_uid;
DROP INDEX IF EXISTS public.pipelines_agency_external_uid;

CREATE UNIQUE INDEX IF NOT EXISTS leads_pipeline_external_uid
  ON public.leads (pipeline_id, external_id);

CREATE UNIQUE INDEX IF NOT EXISTS pipelines_agency_external_uid
  ON public.pipelines (agency_id, external_id);
