import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getServerEnv } from "@/lib/env.server";

/**
 * Service-role Supabase client. Bypasses RLS — use only on the server after
 * strong checks (verified webhooks, or user-authorized flows with explicit scoping).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();
  if (!url || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Admin client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  return createClient(url, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
