-- INSERT ... RETURNING is evaluated before AFTER INSERT triggers run.
-- handle_new_agency runs AFTER INSERT, so the owner row in agency_members
-- does not exist yet when PostgREST evaluates RETURNING against agencies_select.
-- Allow the creating user to read agencies they own so .insert().select() succeeds.

DROP POLICY IF EXISTS "agencies_select" ON public.agencies;

CREATE POLICY "agencies_select"
  ON public.agencies FOR SELECT
  USING (
    owner_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.agency_members m
      WHERE m.agency_id = agencies.id
        AND m.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.is_super_admin
    )
  );
