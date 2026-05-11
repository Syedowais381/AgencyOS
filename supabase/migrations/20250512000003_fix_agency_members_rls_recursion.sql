-- Fix infinite recursion on agency_members RLS: policies must not scan
-- agency_members in a way that re-enters the same policy. Use SECURITY DEFINER
-- helpers that read agency_members with owner privileges (RLS bypass).

CREATE OR REPLACE FUNCTION public.get_agency_ids_for_user(p_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.agency_id
  FROM public.agency_members m
  WHERE m.user_id = p_user_id;
$$;

COMMENT ON FUNCTION public.get_agency_ids_for_user(uuid) IS
  'Returns agency IDs where p_user_id is a member; used by RLS to avoid recursive policy scans on agency_members.';

CREATE OR REPLACE FUNCTION public.user_is_agency_owner_or_admin(
  p_agency_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.agencies a
    WHERE a.id = p_agency_id
      AND a.owner_id = p_user_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.agency_members m
    WHERE m.agency_id = p_agency_id
      AND m.user_id = p_user_id
      AND m.role IN ('owner', 'admin')
  );
$$;

COMMENT ON FUNCTION public.user_is_agency_owner_or_admin(uuid, uuid) IS
  'True if p_user_id owns the agency or is owner/admin member; SECURITY DEFINER to avoid RLS recursion.';

REVOKE ALL ON FUNCTION public.get_agency_ids_for_user(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_is_agency_owner_or_admin(uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_agency_ids_for_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_agency_ids_for_user(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.user_is_agency_owner_or_admin(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_is_agency_owner_or_admin(uuid, uuid) TO service_role;

DROP POLICY IF EXISTS "agency_members_select" ON public.agency_members;
DROP POLICY IF EXISTS "agency_members_insert_by_owner_admin" ON public.agency_members;
DROP POLICY IF EXISTS "agency_members_delete_by_owner_admin" ON public.agency_members;

-- Own row OR any row in an agency the user belongs to (teammates), or super admin.
CREATE POLICY "agency_members_select"
  ON public.agency_members FOR SELECT
  USING (
    user_id = (SELECT auth.uid())
    OR agency_id IN (
      SELECT public.get_agency_ids_for_user((SELECT auth.uid()))
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.is_super_admin
    )
  );

-- Bootstrap: agency owner inserting rows for their agency (covers SECURITY DEFINER trigger).
-- Invites: owner of agency, or existing owner/admin member.
CREATE POLICY "agency_members_insert_by_owner_admin"
  ON public.agency_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.agencies a
      WHERE a.id = agency_members.agency_id
        AND a.owner_id = (SELECT auth.uid())
    )
    OR public.user_is_agency_owner_or_admin(
      agency_members.agency_id,
      (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.is_super_admin
    )
  );

CREATE POLICY "agency_members_delete_by_owner_admin"
  ON public.agency_members FOR DELETE
  USING (
    public.user_is_agency_owner_or_admin(
      agency_members.agency_id,
      (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.is_super_admin
    )
  );
