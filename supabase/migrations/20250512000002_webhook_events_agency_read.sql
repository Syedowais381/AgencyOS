-- Allow agency members to read webhook deliveries scoped to their agency
-- (payloads may include PII — restrict UI exposure in the app layer.)

CREATE POLICY "webhook_events_select_agency"
  ON public.webhook_events FOR SELECT
  USING (
    agency_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.agency_members m
      WHERE m.agency_id = webhook_events.agency_id
        AND m.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.is_super_admin
    )
  );
