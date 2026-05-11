import "server-only";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

export type SessionContext = {
  user: User;
  supabase: Awaited<ReturnType<typeof createClient>>;
};

export async function requireSession(): Promise<SessionContext> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    redirect("/login");
  }
  return { user, supabase };
}

export async function getSessionOptional(): Promise<SessionContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { user, supabase };
}
