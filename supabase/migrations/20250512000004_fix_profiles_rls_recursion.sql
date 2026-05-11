-- Fix infinite recursion on profiles RLS: "profiles_select" referenced
-- public.profiles inside its own USING clause, which re-entered the same policy.

CREATE OR REPLACE FUNCTION public.current_user_is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT p.is_super_admin
      FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
    ),
    false
  );
$$;

COMMENT ON FUNCTION public.current_user_is_super_admin() IS
  'Reads is_super_admin for the session user with RLS bypass; use in policies instead of EXISTS subqueries on profiles.';

REVOKE ALL ON FUNCTION public.current_user_is_super_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_is_super_admin() TO service_role;

DROP POLICY IF EXISTS "profiles_select" ON public.profiles;

CREATE POLICY "profiles_select"
  ON public.profiles FOR SELECT
  USING (
    id = (SELECT auth.uid())
    OR public.current_user_is_super_admin()
  );
